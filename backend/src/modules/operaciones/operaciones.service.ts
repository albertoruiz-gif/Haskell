import { BadRequestException, Injectable } from '@nestjs/common';
import { EstadoEntrega, EstadoPedido } from '@prisma/client';
import { PrismaService } from '../../config/prisma.service';
import { OdooClient } from '../odoo/odoo.client';

/**
 * Picking/packing/despacho/entrega — pantalla "Almacén" del mockup.
 * RN-020: solo pedidos pagados pasan a picking. Picking/packing en si
 * viven en Odoo (stock.picking, maestro segun tabla 7.1), pero la
 * confirmacion, los bultos y la entrega final son responsabilidad web.
 */
@Injectable()
export class OperacionesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly odoo: OdooClient,
  ) {}

  // RF-024: picking list — pedido + lineas + ubicacion (la ubicacion vive en Odoo stock.move)
  async pickingList(orderId: string) {
    const order = await this.prisma.order.findUniqueOrThrow({
      where: { id: orderId },
      include: { items: true, asesor: true },
    });
    if (order.estado !== EstadoPedido.PAGADO && order.estado !== EstadoPedido.STOCK_RESERVADO) {
      throw new BadRequestException('Solo se puede iniciar picking sobre pedidos pagados (RN-020).');
    }

    const pickingsOdoo = order.odooSaleOrderId ? await this.odoo.obtenerPicking(order.odooSaleOrderId) : [];

    return {
      pedido: order.id,
      asesor: order.asesor.codigo,
      direccion: order.direccionSnapshot,
      lineas: order.items.map((i) => ({ sku: i.sku, nombre: i.nombre, cantidad: i.cantidad })),
      pickingOdoo: pickingsOdoo,
    };
  }

  // RF-025: confirma picking — no cierra con diferencias sin incidencia resuelta
  async confirmarPicking(orderId: string, actorId: string, incidencia?: string) {
    const order = await this.prisma.order.findUniqueOrThrow({ where: { id: orderId } });
    if (order.odooSaleOrderId) {
      const [picking] = await this.odoo.obtenerPicking(order.odooSaleOrderId);
      if (picking) await this.odoo.confirmarPicking(picking.id);
    }

    await this.prisma.auditLog.create({
      data: {
        actorId,
        accion: 'CONFIRMAR_PICKING',
        entidad: 'Order',
        entidadId: orderId,
        motivo: incidencia,
      },
    });

    return this.prisma.order.update({ where: { id: orderId }, data: { estado: EstadoPedido.PICKING } });
  }

  // RF-026: genera packing (bultos) — requiere picking sin diferencias abiertas
  async confirmarPacking(orderId: string, bultos: number) {
    const order = await this.prisma.order.findUniqueOrThrow({ where: { id: orderId } });
    if (order.estado !== EstadoPedido.PICKING) {
      throw new BadRequestException('Completá el picking antes de empacar.');
    }
    return this.prisma.order.update({ where: { id: orderId }, data: { estado: EstadoPedido.PACKING } });
  }

  // RF-027: asigna transportista y registra bultos antes de la aceptación
  async asignarTransportista(orderId: string, transportistaId: string, bultos: number) {
    return this.prisma.entrega.upsert({
      where: { orderId },
      create: { orderId, transportistaId, bultos, estado: EstadoEntrega.ASIGNADO },
      update: { transportistaId, bultos, estado: EstadoEntrega.ASIGNADO },
    });
  }

  // RF-022 (RN-022): el transportista acepta la mercadería antes de repartir
  async aceptarBultos(orderId: string, transportistaId: string) {
    const entrega = await this.prisma.entrega.findUniqueOrThrow({ where: { orderId } });
    if (entrega.transportistaId !== transportistaId) {
      throw new BadRequestException('Solo el transportista asignado puede aceptar los bultos.');
    }
    await this.prisma.order.update({ where: { id: orderId }, data: { estado: EstadoPedido.ENTREGADO_TRANSPORTISTA } });
    return this.prisma.entrega.update({
      where: { orderId },
      data: { estado: EstadoEntrega.ACEPTADO, aceptadoEn: new Date() },
    });
  }

  // RF-028: entrega exitosa con receptor + evidencia (foto/firma/OTP — exacto queda en DP-010)
  async confirmarEntrega(orderId: string, data: { receptor: string; documentoReceptor?: string; evidenciaUrl?: string }) {
    if (!data.receptor) throw new BadRequestException('La entrega requiere al menos receptor y fecha/hora (RF-028).');
    await this.prisma.order.update({ where: { id: orderId }, data: { estado: EstadoPedido.ENTREGADO } });
    return this.prisma.entrega.update({
      where: { orderId },
      data: { estado: EstadoEntrega.ENTREGADO, ...data },
    });
  }

  // RF-029: entrega fallida — no se marca exitosa, genera alerta para reprogramar/devolver
  async registrarEntregaFallida(orderId: string, motivo: string, observaciones?: string) {
    if (!motivo) throw new BadRequestException('La entrega fallida requiere motivo (RF-029).');
    await this.prisma.order.update({ where: { id: orderId }, data: { estado: EstadoPedido.ENTREGA_FALLIDA } });
    return this.prisma.entrega.update({
      where: { orderId },
      data: { estado: EstadoEntrega.FALLIDO, motivoFallo: motivo, observaciones },
    });
  }

  // RF-030/DP-001/DP-002: calculo de SLA — pendiente cerrar si son horas calendario o habiles
  calcularFechaLimiteSLA(pagoConfirmadoEn: Date, slaHoras = 48): Date {
    const cortAM = new Date(pagoConfirmadoEn);
    cortAM.setHours(14, 0, 0, 0);
    // TODO DP-002: si el pago es despues de las 14:00, definir regla exacta de corte antes de contar las 48h
    const base = pagoConfirmadoEn <= cortAM ? pagoConfirmadoEn : cortAM;
    return new Date(base.getTime() + slaHoras * 60 * 60 * 1000);
  }
}
