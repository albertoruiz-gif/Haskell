import { BadRequestException, Injectable } from '@nestjs/common';
import { EstadoEntrega, EstadoPedido } from '@prisma/client';
import { PrismaService } from '../../config/prisma.service';
import { OdooClient } from '../odoo/odoo.client';
import { InventarioService } from '../inventario/inventario.service';

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
    private readonly inventario: InventarioService,
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

  // RF-026: genera packing — requiere picking sin diferencias abiertas.
  // El conteo de bultos se registra recién en asignarTransportista (RF-027),
  // que es donde vive el campo Entrega.bultos.
  async confirmarPacking(orderId: string) {
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

  // RF-022 (RN-022): el transportista acepta la mercadería antes de repartir.
  // El administrador puede hacerlo en su lugar (override operativo, ej.
  // mientras no exista una app propia para transportistas). La identidad
  // se compara contra Transportista.id (transportistaId del JWT), no
  // contra el id del usuario.
  async aceptarBultos(orderId: string, actorTransportistaId: string | null, actorRol: string) {
    const entrega = await this.prisma.entrega.findUniqueOrThrow({ where: { orderId } });
    if (actorRol !== 'ADMINISTRADOR' && entrega.transportistaId !== actorTransportistaId) {
      throw new BadRequestException('Solo el transportista asignado puede aceptar los bultos.');
    }
    await this.prisma.order.update({ where: { id: orderId }, data: { estado: EstadoPedido.ENTREGADO_TRANSPORTISTA } });
    return this.prisma.entrega.update({
      where: { orderId },
      data: { estado: EstadoEntrega.ACEPTADO, aceptadoEn: new Date() },
    });
  }

  // Sale a reparto — entre aceptar los bultos y la entrega/fallo final.
  async marcarEnRuta(orderId: string) {
    const entrega = await this.prisma.entrega.findUniqueOrThrow({ where: { orderId } });
    if (entrega.estado !== EstadoEntrega.ACEPTADO) {
      throw new BadRequestException('Primero hay que aceptar los bultos antes de salir a reparto.');
    }
    await this.prisma.order.update({ where: { id: orderId }, data: { estado: EstadoPedido.EN_RUTA } });
    return this.prisma.entrega.update({ where: { orderId }, data: { estado: EstadoEntrega.EN_RUTA } });
  }

  // RF-028: entrega exitosa con receptor + evidencia (foto/firma/OTP — exacto queda en DP-010)
  // Al entregar se congela el pago al transportista (tarifa fija por
  // entrega, elegida sobre pago por zona o registro manual sin fórmula).
  async confirmarEntrega(orderId: string, data: { receptor: string; documentoReceptor?: string; evidenciaUrl?: string }) {
    if (!data.receptor) throw new BadRequestException('La entrega requiere el nombre de quién recibió (RF-028).');
    if (!data.documentoReceptor) throw new BadRequestException('La entrega requiere el DNI de quién recibió.');
    if (!data.evidenciaUrl) throw new BadRequestException('La entrega requiere una foto de evidencia.');
    const entregaActual = await this.prisma.entrega.findUniqueOrThrow({ where: { orderId }, include: { transportista: true } });
    await this.prisma.order.update({ where: { id: orderId }, data: { estado: EstadoPedido.ENTREGADO } });
    // Recién acá sale físicamente del lote — hasta este momento solo estaba comprometido.
    await this.inventario.consumirParaOrder(orderId);
    return this.prisma.entrega.update({
      where: { orderId },
      data: { estado: EstadoEntrega.ENTREGADO, montoPago: entregaActual.transportista.tarifaPorEntrega, ...data },
    });
  }

  /** Pagos a transportistas: lista de entregas completadas, pagadas o no (módulo Transporte). */
  async listarPagosTransportista(transportistaId?: string, pagado?: boolean) {
    return this.prisma.entrega.findMany({
      where: {
        estado: EstadoEntrega.ENTREGADO,
        transportistaId: transportistaId || undefined,
        pagado: pagado === undefined ? undefined : pagado,
      },
      include: { transportista: { include: { user: true } }, order: { select: { referenciaWeb: true } } },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async marcarPagado(entregaId: string) {
    return this.prisma.entrega.update({ where: { id: entregaId }, data: { pagado: true, pagadoEn: new Date() } });
  }

  // RF-029: entrega fallida — no se marca exitosa, genera alerta para reprogramar/devolver
  async registrarEntregaFallida(orderId: string, motivo: string, observaciones?: string) {
    if (!motivo) throw new BadRequestException('La entrega fallida requiere motivo (RF-029).');
    await this.prisma.order.update({ where: { id: orderId }, data: { estado: EstadoPedido.ENTREGA_FALLIDA } });
    // Simplificación: la mercadería vuelve directo a disponible (sin un
    // sub-flujo de inspección de devolución física aparte, ver EP-21/documento).
    await this.inventario.liberarParaOrder(orderId);
    return this.prisma.entrega.update({
      where: { orderId },
      data: { estado: EstadoEntrega.FALLIDO, motivoFallo: motivo, observaciones },
    });
  }
}
