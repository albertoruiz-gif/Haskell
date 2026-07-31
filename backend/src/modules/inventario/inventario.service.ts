import { BadRequestException, Injectable } from '@nestjs/common';
import { EstadoLote } from '@prisma/client';
import { PrismaService } from '../../config/prisma.service';

const ESTADOS_VENDIBLES: EstadoLote[] = ['DISPONIBLE', 'PROXIMO_VENCER'];
const ESTADOS_RESERVA_ACTIVA = ['RESERVADO_TEMPORAL', 'COMPROMETIDO'] as const;
const DIAS_PARA_PROXIMO_VENCER = 30;

/**
 * Inventario de Haskell Perú — se controla desde la nacionalización/ingreso
 * al almacén (la etapa de compra/embarque/aduanas previa queda fuera de
 * este sistema) hasta la venta, devolución o baja de cada lote.
 *
 * FEFO real: reservarParaOrder toma primero el lote con fechaVencimiento
 * más próxima entre los DISPONIBLE/PROXIMO_VENCER. La reserva temporal
 * vence a los 30 min (verificación perezosa — no hay cron en este
 * proyecto, se revisa cada vez que se consulta o intenta reservar stock).
 */
@Injectable()
export class InventarioService {
  constructor(private readonly prisma: PrismaService) {}

  private readonly MINUTOS_RESERVA = 30;

  // ---------- Lotes ----------

  async crearLote(data: {
    catalogLineId: string;
    numeroLote: string;
    proveedor?: string;
    paisOrigen?: string;
    ordenCompra?: string;
    documentoImportacion?: string;
    fechaFabricacion?: string;
    fechaVencimiento?: string;
    cantidadImportada?: number;
    cantidadRecibida: number;
    cantidadDanada?: number;
    costoFob?: number;
    costoFleteSeguro?: number;
    gastosAduaneros?: number;
    costoTotalNacionalizado?: number;
    costoUnitarioReal?: number;
    ubicacionAlmacen?: string;
  }, actorId: string) {
    const lote = await this.prisma.loteInventario.create({
      data: {
        ...data,
        fechaFabricacion: data.fechaFabricacion ? new Date(data.fechaFabricacion) : undefined,
        fechaVencimiento: data.fechaVencimiento ? new Date(data.fechaVencimiento) : undefined,
        responsableRecepcionId: actorId,
      },
    });
    await this.prisma.auditLog.create({
      data: { actorId, accion: 'CREAR_LOTE', entidad: 'LoteInventario', entidadId: lote.id, valoresDespues: { numeroLote: data.numeroLote, cantidadRecibida: data.cantidadRecibida } },
    });
    await this.recalcularStock(data.catalogLineId);
    return lote;
  }

  async listarLotes(catalogLineId?: string) {
    await this.recalcularVencimientos(catalogLineId);
    return this.prisma.loteInventario.findMany({
      where: catalogLineId ? { catalogLineId } : undefined,
      include: { catalogLine: { select: { sku: true, nombre: true } } },
      orderBy: [{ fechaVencimiento: 'asc' }],
    });
  }

  async cambiarEstadoLote(id: string, estado: EstadoLote, motivo: string | undefined, actorId: string) {
    const lote = await this.prisma.loteInventario.findUniqueOrThrow({ where: { id } });
    if (estado === 'BLOQUEADO' && !motivo) {
      throw new BadRequestException('Bloquear un lote requiere un motivo.');
    }
    const actualizado = await this.prisma.loteInventario.update({
      where: { id },
      data: {
        estado,
        motivoBloqueo: estado === 'BLOQUEADO' ? motivo : lote.motivoBloqueo,
        fechaLiberacion: estado === 'DISPONIBLE' && !lote.fechaLiberacion ? new Date() : lote.fechaLiberacion,
      },
    });
    await this.prisma.auditLog.create({
      data: { actorId, accion: 'CAMBIAR_ESTADO_LOTE', entidad: 'LoteInventario', entidadId: id, valoresAntes: { estado: lote.estado }, valoresDespues: { estado }, motivo },
    });
    await this.recalcularStock(lote.catalogLineId);
    return actualizado;
  }

  /** DISPONIBLE → PROXIMO_VENCER (≤30 días) → VENCIDO — verificación perezosa, no hay cron en este proyecto. */
  async recalcularVencimientos(catalogLineId?: string) {
    const ahora = new Date();
    const prontoLimite = new Date(ahora.getTime() + DIAS_PARA_PROXIMO_VENCER * 24 * 60 * 60 * 1000);
    const lotes = await this.prisma.loteInventario.findMany({
      where: { catalogLineId, fechaVencimiento: { not: null }, estado: { in: ['DISPONIBLE', 'PROXIMO_VENCER'] } },
    });
    for (const lote of lotes) {
      if (lote.fechaVencimiento! <= ahora) {
        await this.prisma.loteInventario.update({ where: { id: lote.id }, data: { estado: 'VENCIDO' } });
      } else if (lote.fechaVencimiento! <= prontoLimite && lote.estado === 'DISPONIBLE') {
        await this.prisma.loteInventario.update({ where: { id: lote.id }, data: { estado: 'PROXIMO_VENCER' } });
      }
    }
  }

  // ---------- Stock: reservar / comprometer / liberar / consumir ----------

  /** FEFO: reserva contra el/los lote(s) con vencimiento más próximo. Si falta stock, libera lo ya reservado en este pedido y rechaza. */
  async reservarParaOrder(orderId: string) {
    await this.liberarReservasVencidas();
    const order = await this.prisma.order.findUniqueOrThrow({ where: { id: orderId }, include: { items: true } });

    try {
      for (const item of order.items) {
        const catalogLine = await this.prisma.catalogLine.findFirst({ where: { catalogId: order.catalogId, sku: item.sku } });
        if (!catalogLine) throw new BadRequestException(`El producto ${item.sku} ya no existe en el catálogo.`);

        let pendiente = item.cantidad;
        const lotes = await this.prisma.loteInventario.findMany({
          where: { catalogLineId: catalogLine.id, estado: { in: ESTADOS_VENDIBLES } },
          include: { reservas: { where: { estado: { in: [...ESTADOS_RESERVA_ACTIVA] } } } },
          orderBy: [{ fechaVencimiento: 'asc' }],
        });

        const expiraEn = new Date(Date.now() + this.MINUTOS_RESERVA * 60_000);
        for (const lote of lotes) {
          if (pendiente <= 0) break;
          const reservadoEnLote = lote.reservas.reduce((acc, r) => acc + r.cantidad, 0);
          const disponibleEnLote = lote.cantidadRecibida - lote.cantidadDanada - reservadoEnLote;
          if (disponibleEnLote <= 0) continue;
          const tomar = Math.min(disponibleEnLote, pendiente);
          await this.prisma.reservaStock.create({
            data: { loteId: lote.id, orderItemId: item.id, cantidad: tomar, estado: 'RESERVADO_TEMPORAL', expiraEn },
          });
          pendiente -= tomar;
        }

        if (pendiente > 0) {
          throw new BadRequestException(`Stock insuficiente para ${catalogLine.nombre ?? item.sku} (faltan ${pendiente} unidades).`);
        }
        await this.recalcularStock(catalogLine.id);
      }
    } catch (e) {
      await this.liberarParaOrder(orderId);
      throw e;
    }
  }

  async comprometerParaOrder(orderId: string) {
    const items = await this.prisma.orderItem.findMany({ where: { orderId } });
    for (const item of items) {
      await this.prisma.reservaStock.updateMany({
        where: { orderItemId: item.id, estado: 'RESERVADO_TEMPORAL' },
        data: { estado: 'COMPROMETIDO', expiraEn: null },
      });
    }
    await this.recalcularStockDeOrder(orderId);
  }

  /** Cancelación, entrega fallida, o reserva vencida — libera lo reservado/comprometido de vuelta a disponible. */
  async liberarParaOrder(orderId: string) {
    const items = await this.prisma.orderItem.findMany({ where: { orderId } });
    for (const item of items) {
      await this.prisma.reservaStock.updateMany({
        where: { orderItemId: item.id, estado: { in: [...ESTADOS_RESERVA_ACTIVA] } },
        data: { estado: 'LIBERADO' },
      });
    }
    await this.recalcularStockDeOrder(orderId);
  }

  /** Entrega confirmada — sale físicamente del lote (única vez que cantidadRecibida baja de verdad). */
  async consumirParaOrder(orderId: string) {
    const items = await this.prisma.orderItem.findMany({
      where: { orderId },
      include: { reservas: { where: { estado: 'COMPROMETIDO' } } },
    });
    for (const item of items) {
      for (const reserva of item.reservas) {
        await this.prisma.loteInventario.update({
          where: { id: reserva.loteId },
          data: { cantidadRecibida: { decrement: reserva.cantidad } },
        });
        await this.prisma.reservaStock.update({ where: { id: reserva.id }, data: { estado: 'CONSUMIDO' } });
      }
    }
    await this.recalcularStockDeOrder(orderId);
  }

  /** Reservas RESERVADO_TEMPORAL con expiraEn pasado: se liberan y el pedido (si sigue PENDIENTE_PAGO) se anula. */
  async liberarReservasVencidas() {
    const vencidas = await this.prisma.reservaStock.findMany({
      where: { estado: 'RESERVADO_TEMPORAL', expiraEn: { lte: new Date() } },
      include: { orderItem: true, lote: { select: { catalogLineId: true } } },
    });
    if (vencidas.length === 0) return;

    await this.prisma.reservaStock.updateMany({
      where: { id: { in: vencidas.map((v) => v.id) } },
      data: { estado: 'LIBERADO' },
    });

    const orderIds = new Set(vencidas.map((v) => v.orderItem.orderId));
    for (const orderId of orderIds) {
      await this.prisma.order.updateMany({ where: { id: orderId, estado: 'PENDIENTE_PAGO' }, data: { estado: 'ANULADO_POR_VENCIMIENTO' } });
    }

    const catalogLineIds = new Set(vencidas.map((v) => v.lote.catalogLineId));
    for (const id of catalogLineIds) await this.recalcularStock(id);
  }

  // ---------- Recalculo / consulta ----------

  private async recalcularStockDeOrder(orderId: string) {
    const order = await this.prisma.order.findUniqueOrThrow({ where: { id: orderId }, include: { items: true } });
    const catalogLineIds = new Set<string>();
    for (const item of order.items) {
      const cl = await this.prisma.catalogLine.findFirst({ where: { catalogId: order.catalogId, sku: item.sku }, select: { id: true } });
      if (cl) catalogLineIds.add(cl.id);
    }
    for (const id of catalogLineIds) await this.recalcularStock(id);
  }

  async recalcularStock(catalogLineId: string) {
    const lotes = await this.prisma.loteInventario.findMany({
      where: { catalogLineId, estado: { in: ESTADOS_VENDIBLES } },
      include: { reservas: { where: { estado: { in: [...ESTADOS_RESERVA_ACTIVA] } } } },
    });
    const disponible = lotes.reduce((acc, lote) => {
      const reservado = lote.reservas.reduce((a, r) => a + r.cantidad, 0);
      return acc + Math.max(0, lote.cantidadRecibida - lote.cantidadDanada - reservado);
    }, 0);
    await this.prisma.catalogLine.update({ where: { id: catalogLineId }, data: { stockDisponible: disponible } });
  }

  async stockBreakdown(catalogLineId: string) {
    await this.liberarReservasVencidas();
    await this.recalcularVencimientos(catalogLineId);
    await this.recalcularStock(catalogLineId);

    const [lotes, catalogLine] = await Promise.all([
      this.prisma.loteInventario.findMany({ where: { catalogLineId }, include: { reservas: true } }),
      this.prisma.catalogLine.findUniqueOrThrow({ where: { id: catalogLineId } }),
    ]);

    const breakdown = { fisico: 0, bloqueado: 0, danado: 0, proximoVencer: 0, vencido: 0, reservadoTemporal: 0, comprometido: 0 };
    for (const lote of lotes) {
      const netos = lote.cantidadRecibida - lote.cantidadDanada;
      if (lote.estado !== 'DADO_DE_BAJA') breakdown.fisico += netos;
      if (lote.estado === 'BLOQUEADO') breakdown.bloqueado += netos;
      if (lote.estado === 'DANADO') breakdown.danado += netos;
      if (lote.estado === 'PROXIMO_VENCER') breakdown.proximoVencer += netos;
      if (lote.estado === 'VENCIDO') breakdown.vencido += netos;
      for (const r of lote.reservas) {
        if (r.estado === 'RESERVADO_TEMPORAL') breakdown.reservadoTemporal += r.cantidad;
        if (r.estado === 'COMPROMETIDO') breakdown.comprometido += r.cantidad;
      }
    }

    return { ...breakdown, disponible: catalogLine.stockDisponible };
  }
}
