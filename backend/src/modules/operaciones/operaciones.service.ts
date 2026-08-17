import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { EstadoEntrega, EstadoPedido } from '@prisma/client';
import { PrismaService } from '../../config/prisma.service';
import { OdooClient } from '../odoo/odoo.client';
import { InventarioService } from '../inventario/inventario.service';
import { formatearNumeroPedido } from '../../common/numero-pedido.util';
import { calcularEstadoSaludEntrega, calcularFechaEntregaPrometida } from '../../common/sla.util';
import { ESTADO_PEDIDO_LABEL } from '../../common/estados-pedido.util';

/**
 * Picking/packing/despacho/entrega — pantalla "Almacén" del mockup.
 * RN-020: solo pedidos pagados pasan a picking. Picking/packing en si
 * viven en Odoo (stock.picking, maestro segun tabla 7.1), pero la
 * confirmacion, los bultos y la entrega final son responsabilidad web.
 */
@Injectable()
export class OperacionesService {
  private readonly logger = new Logger(OperacionesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly odoo: OdooClient,
    private readonly inventario: InventarioService,
  ) {}

  /**
   * Espejo de solo lectura del estado del pedido en Odoo (stock.picking) —
   * ver catalogo-haskell/PROMPT_sync_delivery_a_odoo.md y
   * PROMPT_investigar_estados_pago.md (incluye x_estado_pedido, que usa la
   * AI Tool "Consultar estado de pedido" de Hasky/Live Chat, no solo el
   * tramo de delivery). Best-effort: si Odoo falla, el cambio de estado en
   * la plataforma igual queda hecho (la plataforma sigue siendo la fuente
   * de verdad), solo se registra en el log.
   */
  async sincronizarEstadoPedidoAOdoo(orderId: string) {
    try {
      const order = await this.prisma.order.findUniqueOrThrow({
        where: { id: orderId },
        include: { asesor: true, entrega: { include: { transportista: { include: { user: true } } } } },
      });

      let transportistaPartnerId: number | null = null;
      if (order.entrega) {
        const t = order.entrega.transportista;
        transportistaPartnerId = await this.odoo.upsertTransportistaComoPartner({
          odooPartnerId: t.odooPartnerId,
          nombre: t.user.nombre,
          telefono: t.telefono,
        });
        if (!t.odooPartnerId) {
          await this.prisma.transportista.update({ where: { id: t.id }, data: { odooPartnerId: transportistaPartnerId } });
        }
      }

      await this.odoo.sincronizarDeliveryAOdoo({
        pedidoExternoId: formatearNumeroPedido(order.canal, order.numero),
        clientePartnerId: order.asesor.odooPartnerId,
        transportistaPartnerId,
        scheduledDate: order.pagadoEn ? calcularFechaEntregaPrometida(order.pagadoEn) : null,
        dateDone: order.entrega?.estado === 'ENTREGADO' ? order.entrega.updatedAt : null,
        enTransito: order.entrega?.estado === 'EN_RUTA',
        recibidoNombre: order.entrega?.receptor ?? null,
        recibidoDni: order.entrega?.documentoReceptor ?? null,
        devueltoCausa: order.entrega?.motivoFallo ?? null,
        estadoDelivery: calcularEstadoSaludEntrega({
          pagadoEn: order.pagadoEn,
          entregaEstado: order.entrega?.estado ?? null,
          entregaUpdatedAt: order.entrega?.updatedAt ?? null,
        }),
        estadoPedido: ESTADO_PEDIDO_LABEL[order.estado],
      });
    } catch (e) {
      this.logger.warn(`No se pudo sincronizar el estado del pedido a Odoo para pedido ${orderId}: ${e instanceof Error ? e.message : e}`);
    }
  }

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

    const actualizado = await this.prisma.order.update({ where: { id: orderId }, data: { estado: EstadoPedido.PICKING } });
    await this.sincronizarEstadoPedidoAOdoo(orderId);
    return actualizado;
  }

  // RF-026: genera packing — requiere picking sin diferencias abiertas.
  // El conteo de bultos se registra recién en asignarTransportista (RF-027),
  // que es donde vive el campo Entrega.bultos.
  async confirmarPacking(orderId: string) {
    const order = await this.prisma.order.findUniqueOrThrow({ where: { id: orderId } });
    if (order.estado !== EstadoPedido.PICKING) {
      throw new BadRequestException('Completá el picking antes de empacar.');
    }
    const actualizado = await this.prisma.order.update({ where: { id: orderId }, data: { estado: EstadoPedido.PACKING } });
    await this.sincronizarEstadoPedidoAOdoo(orderId);
    return actualizado;
  }

  // RF-027: asigna transportista y registra bultos antes de la aceptación
  async asignarTransportista(orderId: string, transportistaId: string, bultos: number) {
    const entrega = await this.prisma.entrega.upsert({
      where: { orderId },
      create: { orderId, transportistaId, bultos, estado: EstadoEntrega.ASIGNADO },
      update: { transportistaId, bultos, estado: EstadoEntrega.ASIGNADO },
    });
    await this.sincronizarEstadoPedidoAOdoo(orderId);
    return entrega;
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
    const actualizada = await this.prisma.entrega.update({
      where: { orderId },
      data: { estado: EstadoEntrega.ACEPTADO, aceptadoEn: new Date() },
    });
    await this.sincronizarEstadoPedidoAOdoo(orderId);
    return actualizada;
  }

  // Sale a reparto — entre aceptar los bultos y la entrega/fallo final.
  async marcarEnRuta(orderId: string) {
    const entrega = await this.prisma.entrega.findUniqueOrThrow({ where: { orderId } });
    if (entrega.estado !== EstadoEntrega.ACEPTADO) {
      throw new BadRequestException('Primero hay que aceptar los bultos antes de salir a reparto.');
    }
    await this.prisma.order.update({ where: { id: orderId }, data: { estado: EstadoPedido.EN_RUTA } });
    const actualizada = await this.prisma.entrega.update({ where: { orderId }, data: { estado: EstadoEntrega.EN_RUTA } });
    await this.sincronizarEstadoPedidoAOdoo(orderId);
    await this.notificarAsesor(orderId, 'Tu pedido salió a reparto', ['Tu pedido ya está en camino hacia la dirección de entrega.']);
    return actualizada;
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
    const actualizada = await this.prisma.entrega.update({
      where: { orderId },
      data: { estado: EstadoEntrega.ENTREGADO, montoPago: entregaActual.transportista.tarifaPorEntrega, ...data },
    });
    await this.sincronizarEstadoPedidoAOdoo(orderId);
    await this.notificarAsesor(orderId, 'Tu pedido fue entregado', [`Entregado a: ${data.receptor}.`]);
    return actualizada;
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
    const actualizada = await this.prisma.entrega.update({
      where: { orderId },
      data: { estado: EstadoEntrega.FALLIDO, motivoFallo: motivo, observaciones },
    });
    await this.sincronizarEstadoPedidoAOdoo(orderId);
    await this.notificarAsesor(orderId, 'Hubo un problema con la entrega de tu pedido', [
      `Motivo: ${motivo}.`,
      'Nos vamos a poner en contacto para coordinar un nuevo intento de entrega.',
    ]);
    return actualizada;
  }

  // EP-12: reprograma una entrega que falló — vuelve a ASIGNADO (mismo
  // transportista, sin pasar por asignarTransportista otra vez) para que
  // el flujo normal (aceptar -> en-ruta -> confirmar/fallida) se repita.
  // registrarEntregaFallida ya había liberado el stock reservado, así que
  // hay que volver a comprometerlo — si ya no queda disponible, esto
  // rechaza acá mismo (no tiene sentido prometer una redelivery sin
  // mercadería real).
  async reprogramarEntrega(orderId: string, actorId: string, data: { fechaReprogramada: Date; motivo?: string }) {
    const entrega = await this.prisma.entrega.findUniqueOrThrow({ where: { orderId } });
    if (entrega.estado !== EstadoEntrega.FALLIDO) {
      throw new BadRequestException('Solo se puede reprogramar una entrega que falló.');
    }

    await this.inventario.reservarParaOrder(orderId);
    await this.inventario.comprometerParaOrder(orderId);

    await this.prisma.order.update({ where: { id: orderId }, data: { estado: EstadoPedido.PACKING } });
    const actualizada = await this.prisma.entrega.update({
      where: { orderId },
      data: {
        estado: EstadoEntrega.ASIGNADO,
        aceptadoEn: null,
        fechaReprogramada: data.fechaReprogramada,
        motivoReprogramacion: data.motivo,
        vecesReprogramada: { increment: 1 },
      },
    });
    await this.prisma.auditLog.create({
      data: {
        actorId,
        accion: 'REPROGRAMAR_ENTREGA',
        entidad: 'Entrega',
        entidadId: actualizada.id,
        motivo: data.motivo,
        valoresDespues: { fechaReprogramada: data.fechaReprogramada.toISOString() },
      },
    });
    await this.sincronizarEstadoPedidoAOdoo(orderId);
    await this.notificarAsesor(orderId, 'Tu pedido tiene una nueva fecha de entrega', [
      `Reprogramamos la entrega para el ${data.fechaReprogramada.toLocaleDateString('es-PE', { weekday: 'long', day: '2-digit', month: '2-digit' })}.`,
      ...(data.motivo ? [`Motivo: ${data.motivo}.`] : []),
    ]);
    return actualizada;
  }

  /**
   * EP-12: notificación proactiva por correo cuando cambia el estado de la
   * entrega — al Asesor que hizo el pedido (no hay un "cliente final"
   * propio en COMERCIO_MINORISTA; en SALONES_BELLEZA/RETAIL el Asesor es
   * quien vende y espera la entrega para su Cliente, así que sigue siendo
   * el destinatario correcto). Mismo canal que ya usa AuthService para
   * activación/recuperación de clave: Odoo como relay de correo saliente
   * (ver OdooClient.enviarCorreo — AWS SES nunca se conectó a ningún flujo
   * real y se descartó del todo, no es "sandbox esperando salir" como decía
   * un comentario viejo, ver docs/LECCIONES_APRENDIDAS_INTEGRACIONES.md §4).
   * Best-effort: si el correo falla, nunca tumba el cambio de estado real
   * que ya quedó guardado — solo se registra en el log.
   */
  private async notificarAsesor(orderId: string, asunto: string, parrafos: string[]) {
    try {
      const order = await this.prisma.order.findUniqueOrThrow({
        where: { id: orderId },
        include: { asesor: { include: { user: true } } },
      });
      const numero = formatearNumeroPedido(order.canal, order.numero);
      const htmlCuerpo = `
        <p>Hola ${order.asesor.user.nombre},</p>
        <p>Novedades de tu pedido <strong>${numero}</strong>:</p>
        ${parrafos.filter(Boolean).map((p) => `<p>${p}</p>`).join('')}
        <p>Podés ver el detalle completo en Mis Ventas.</p>
      `;
      await this.odoo.enviarCorreo({ para: order.asesor.user.email, asunto, htmlCuerpo });
    } catch (e) {
      this.logger.warn(`No se pudo enviar la notificación de estado del pedido ${orderId}: ${e instanceof Error ? e.message : e}`);
    }
  }
}
