import { BadRequestException, Injectable } from '@nestjs/common';
import { EstadoPedido } from '@prisma/client';
import { PrismaService } from '../../config/prisma.service';
import { PricingService } from '../pricing/pricing.service';
import { CampaignsService } from '../campaigns/campaigns.service';
import { OdooClient } from '../odoo/odoo.client';

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pricing: PricingService,
    private readonly campaigns: CampaignsService,
    private readonly odoo: OdooClient,
  ) {}

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

    return this.prisma.order.create({
      data: {
        asesorId: cart.asesorId,
        canal: catalog.canal,
        campaignId: catalog.campaignId,
        catalogId: catalog.id,
        catalogVersion: catalog.version,
        direccionSnapshot: { ...direccion },
        tarifaSnapshot: tarifa.precio,
        subtotalAsesor: items.reduce((acc, i) => acc + i.precioAsesorUnitario * i.cantidad, 0),
        totalCulqi,
        estado: EstadoPedido.PENDIENTE_PAGO,
        items: { create: items },
      },
      include: { items: true },
    });
  }

  /** RF-022/RF-036: tras el pago aprobado, confirma el pedido y lo crea en Odoo. Idempotente por referenciaWeb. */
  async confirmarPagoYEnviarAOdoo(orderId: string, culqiChargeId: string) {
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

    return this.prisma.order.update({
      where: { id: orderId },
      data: { estado: EstadoPedido.PAGADO, odooSaleOrderId },
    });
  }
}
