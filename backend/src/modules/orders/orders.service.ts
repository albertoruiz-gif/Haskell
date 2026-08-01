import { BadRequestException, Injectable } from '@nestjs/common';
import { EstadoPedido } from '@prisma/client';
import { PrismaService } from '../../config/prisma.service';
import { PricingService } from '../pricing/pricing.service';
import { CampaignsService } from '../campaigns/campaigns.service';
import { OdooClient } from '../odoo/odoo.client';
import { InventarioService } from '../inventario/inventario.service';
import { calcularFechaEntregaPrometida } from '../../common/sla.util';

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pricing: PricingService,
    private readonly campaigns: CampaignsService,
    private readonly odoo: OdooClient,
    private readonly inventario: InventarioService,
  ) {}

  /** Reserva stock real (FEFO) para el pedido recién creado — si falta stock, el pedido queda cancelado y se rechaza. */
  private async reservarOCancelar(orderId: string) {
    try {
      await this.inventario.reservarParaOrder(orderId);
    } catch (e) {
      await this.prisma.order.update({ where: { id: orderId }, data: { estado: EstadoPedido.CANCELADO_DEVUELTO } });
      throw e;
    }
  }

  /**
   * RF-017: revalida todo antes de abrir Culqi. RN-038: el pedido congela
   * PVP, % asesor, promoción y dirección — cambios posteriores no lo alteran.
   */
  async prepararPedidoDesdeCarrito(cartId: string) {
    const cart = await this.prisma.cart.findUniqueOrThrow({
      where: { id: cartId },
      include: { items: { include: { catalogLine: { include: { catalog: true } } } }, asesor: { include: { direcciones: true } } },
    });

    if (cart.vigenciaHasta < new Date()) {
      throw new BadRequestException('La reserva del carrito venció. Volvé a agregar los productos.');
    }
    if (cart.items.length === 0) {
      throw new BadRequestException('El carrito está vacío.');
    }

    const catalog = cart.items[0].catalogLine.catalog;
    // RN-039: no mezclar catálogos de canales distintos
    const catalogosDistintos = cart.items.some((i) => i.catalogLine.catalog.id !== catalog.id);
    if (catalogosDistintos) {
      throw new BadRequestException('No se pueden mezclar productos de catálogos de canales diferentes (RN-039).');
    }
    if (catalog.estado !== 'PUBLICADO') {
      throw new BadRequestException('El catálogo ya no está publicado — refrescá el carrito (PA-032).');
    }

    const direccion = cart.asesor.direcciones.find((d) => d.id === cart.direccionId);
    if (!direccion) throw new BadRequestException('Seleccioná una dirección de entrega.');

    const tarifa = await this.prisma.tarifa.findUnique({ where: { distrito: direccion.distrito } });
    if (!tarifa || !tarifa.activa) {
      throw new BadRequestException('El distrito seleccionado no tiene tarifa de envío activa (RF-016).');
    }

    const items = await Promise.all(
      cart.items.map(async (item) => {
        const porcentaje = await this.pricing.resolverPorcentajeAsesor({
          campaignId: catalog.campaignId,
          catalogId: catalog.id,
          canal: catalog.canal,
        });
        const oferta = await this.campaigns.ofertaVigentePara(item.catalogLineId);
        const pvpEfectivo = oferta?.precioFijo
          ? Number(oferta.precioFijo)
          : oferta?.descuentoPct
            ? Number(item.catalogLine.pvpCampania) * (1 - Number(oferta.descuentoPct) / 100)
            : Number(item.catalogLine.pvpCampania);

        return {
          sku: item.catalogLine.sku,
          nombre: item.catalogLine.sku, // TODO: reemplazar por nombre real cuando exista mapeo SKU -> Odoo product.product
          pvpUnitario: pvpEfectivo,
          porcentajeAsesorAplicado: porcentaje,
          precioAsesorUnitario: this.pricing.calcularPrecioAsesor(pvpEfectivo, porcentaje),
          cantidad: item.cantidad,
          promocionAplicada: oferta ? { ofertaId: oferta.id, tipo: oferta.tipo } : undefined,
        };
      }),
    );

    const totalCulqi = this.pricing.calcularTotalCulqi(
      items.map((i) => ({ pvpUnitario: i.pvpUnitario, porcentaje: i.porcentajeAsesorAplicado, cantidad: i.cantidad })),
      Number(tarifa.precio),
    );

    const order = await this.prisma.order.create({
      data: {
        asesorId: cart.asesorId,
        canal: catalog.canal,
        campaignId: catalog.campaignId,
        catalogId: catalog.id,
        catalogVersion: catalog.version,
        direccionSnapshot: { ...direccion },
        tarifaSnapshot: tarifa.precio,
        slaHorasSnapshot: tarifa.slaHoras,
        subtotalAsesor: items.reduce((acc, i) => acc + i.precioAsesorUnitario * i.cantidad, 0),
        totalCulqi,
        estado: EstadoPedido.PENDIENTE_PAGO,
        items: { create: items },
      },
      include: { items: true },
    });
    await this.reservarOCancelar(order.id);
    return order;
  }

  /**
   * Variante de prepararPedidoDesdeCarrito que no depende del modelo Cart
   * (el carrito de la app hoy vive en el cliente, localStorage) — recibe
   * directo la lista de items y arma el pedido igual, con la misma
   * revalidacion de precio/oferta/tarifa (RF-017, RN-038).
   */
  async crearPedidoDesdeItems(asesorId: string, itemsSolicitados: { catalogLineId: string; cantidad: number }[]) {
    if (itemsSolicitados.length === 0) throw new BadRequestException('El carrito está vacío.');

    const asesor = await this.prisma.asesor.findUniqueOrThrow({ where: { id: asesorId }, include: { direcciones: true } });
    const direccion = asesor.direcciones.find((d) => d.predeterminada) ?? asesor.direcciones[0];
    if (!direccion) throw new BadRequestException('El asesor no tiene una dirección de entrega registrada.');

    const tarifa = await this.prisma.tarifa.findUnique({ where: { distrito: direccion.distrito } });
    if (!tarifa || !tarifa.activa) {
      throw new BadRequestException('El distrito de tu dirección no tiene tarifa de envío activa (RF-016).');
    }

    const lineas = await this.prisma.catalogLine.findMany({
      where: { id: { in: itemsSolicitados.map((i) => i.catalogLineId) } },
      include: { catalog: true },
    });
    if (lineas.length !== itemsSolicitados.length) {
      throw new BadRequestException('Alguno de los productos del carrito ya no existe en el catálogo.');
    }

    const catalog = lineas[0].catalog;
    if (lineas.some((l) => l.catalogId !== catalog.id)) {
      throw new BadRequestException('No se pueden mezclar productos de catálogos de canales diferentes (RN-039).');
    }
    if (catalog.estado !== 'PUBLICADO') {
      throw new BadRequestException('El catálogo ya no está publicado — refrescá el carrito (PA-032).');
    }

    const items = await Promise.all(
      itemsSolicitados.map(async ({ catalogLineId, cantidad }) => {
        const linea = lineas.find((l) => l.id === catalogLineId)!;
        const porcentaje = await this.pricing.resolverPorcentajeAsesor({
          campaignId: catalog.campaignId,
          catalogId: catalog.id,
          canal: catalog.canal,
        });
        const oferta = await this.campaigns.ofertaVigentePara(catalogLineId);
        const pvpEfectivo = oferta?.precioFijo
          ? Number(oferta.precioFijo)
          : oferta?.descuentoPct
            ? Number(linea.pvpCampania) * (1 - Number(oferta.descuentoPct) / 100)
            : Number(linea.pvpCampania);

        return {
          sku: linea.sku,
          nombre: linea.nombre ?? linea.sku,
          pvpUnitario: pvpEfectivo,
          porcentajeAsesorAplicado: porcentaje,
          precioAsesorUnitario: this.pricing.calcularPrecioAsesor(pvpEfectivo, porcentaje),
          cantidad,
          promocionAplicada: oferta ? { ofertaId: oferta.id, tipo: oferta.tipo } : undefined,
        };
      }),
    );

    const totalCulqi = this.pricing.calcularTotalCulqi(
      items.map((i) => ({ pvpUnitario: i.pvpUnitario, porcentaje: i.porcentajeAsesorAplicado, cantidad: i.cantidad })),
      Number(tarifa.precio),
    );

    const order = await this.prisma.order.create({
      data: {
        asesorId: asesor.id,
        canal: catalog.canal,
        campaignId: catalog.campaignId,
        catalogId: catalog.id,
        catalogVersion: catalog.version,
        direccionSnapshot: { ...direccion },
        tarifaSnapshot: tarifa.precio,
        slaHorasSnapshot: tarifa.slaHoras,
        subtotalAsesor: items.reduce((acc, i) => acc + i.precioAsesorUnitario * i.cantidad, 0),
        totalCulqi,
        estado: EstadoPedido.PENDIENTE_PAGO,
        items: { create: items },
      },
      include: { items: true },
    });
    await this.reservarOCancelar(order.id);
    return order;
  }

  /** Para el panel de Gestión → Pagos y Almacén → Despacho: pedidos por estado (todos si no se pide uno). */
  async listarPedidos(estado?: EstadoPedido) {
    const pedidos = await this.prisma.order.findMany({
      where: estado ? { estado } : { estado: { in: [EstadoPedido.PENDIENTE_PAGO, EstadoPedido.PAGADO, EstadoPedido.CANCELADO_DEVUELTO] } },
      include: { asesor: { include: { user: true } }, items: true, entrega: true },
      orderBy: { createdAt: 'desc' },
    });
    // RF-030: fecha de entrega prometida, calculada (no se persiste) a partir
    // de pagadoEn — ver common/sla.util.ts para la regla de corte.
    return pedidos.map((p) => ({
      ...p,
      fechaEntregaPrometida: p.pagadoEn ? calcularFechaEntregaPrometida(p.pagadoEn) : null,
    }));
  }

  /**
   * Validación manual del pago (RF-018 Yape): el asesor paga por Yape y un
   * gerente/administrador confirma visualmente que el monto llegó. No hay
   * webhook de Culqi conectado todavía — es una confirmación humana, no
   * una verificación automática contra la pasarela. `pagadoEn` es el punto
   * de partida del plazo de entrega (RF-030).
   */
  async validarPagoManual(orderId: string, actorId: string) {
    await this.prisma.auditLog.create({
      data: { actorId, accion: 'VALIDAR_PAGO', entidad: 'Order', entidadId: orderId },
    });
    // TODO RF-036: una vez con credenciales reales de Odoo, encadenar
    // confirmarPagoYEnviarAOdoo aca en vez de solo marcar PAGADO.
    const actualizado = await this.prisma.order.update({ where: { id: orderId }, data: { estado: EstadoPedido.PAGADO, pagadoEn: new Date() } });
    await this.inventario.comprometerParaOrder(orderId);
    return actualizado;
  }

  async rechazarPedido(orderId: string, actorId: string, motivo?: string) {
    await this.prisma.auditLog.create({
      data: { actorId, accion: 'RECHAZAR_PEDIDO', entidad: 'Order', entidadId: orderId, motivo },
    });
    const actualizado = await this.prisma.order.update({ where: { id: orderId }, data: { estado: EstadoPedido.CANCELADO_DEVUELTO } });
    await this.inventario.liberarParaOrder(orderId);
    return actualizado;
  }

  /** RF-022/RF-036: tras el pago aprobado, confirma el pedido y lo crea en Odoo. Idempotente por referenciaWeb. */
  async confirmarPagoYEnviarAOdoo(orderId: string) {
    const order = await this.prisma.order.findUniqueOrThrow({ where: { id: orderId }, include: { asesor: true, items: true } });

    if (order.estado === EstadoPedido.PAGADO && order.odooSaleOrderId) {
      return order; // RF-020: idempotencia, no duplica
    }

    const partnerId = await this.odoo.upsertAsesorComoPartner({
      odooPartnerId: order.asesor.odooPartnerId,
      nombre: order.asesor.codigo,
      telefono: order.asesor.telefonoPrincipal,
      dni: order.asesor.numeroDocumento,
    });

    // TODO: mapear order.items[].sku -> odooProductId real (requiere tabla de sincronizacion de productos, ver odoo.client.obtenerProductos)
    const odooSaleOrderId = await this.odoo.crearPedidoVenta({
      partnerId,
      referenciaWeb: order.referenciaWeb,
      lineas: order.items.map((i) => ({ odooProductId: 0, cantidad: i.cantidad, precioUnitario: Number(i.precioAsesorUnitario) })),
    });

    const actualizado = await this.prisma.order.update({
      where: { id: orderId },
      data: { estado: EstadoPedido.PAGADO, odooSaleOrderId },
    });
    await this.inventario.comprometerParaOrder(orderId);
    return actualizado;
  }
}
