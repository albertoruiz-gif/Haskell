import { BadRequestException, Injectable } from '@nestjs/common';
import { Canal, EstadoPedido, FormaPago } from '@prisma/client';
import { PrismaService } from '../../config/prisma.service';
import { PricingService } from '../pricing/pricing.service';
import { CampaignsService } from '../campaigns/campaigns.service';
import { OdooClient } from '../odoo/odoo.client';
import { InventarioService } from '../inventario/inventario.service';
import { OperacionesService } from '../operaciones/operaciones.service';
import { ClientesService } from '../clientes/clientes.service';
import { calcularFechaEntregaPrometida } from '../../common/sla.util';

// EP-21 — solo estos canales admiten Cliente/formaPago distinta de
// CONTADO_CULQI. En COMERCIO_MINORISTA el Asesor compra para sí mismo.
const CANALES_CON_CREDITO: Canal[] = ['SALONES_BELLEZA', 'RETAIL'];

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pricing: PricingService,
    private readonly campaigns: CampaignsService,
    private readonly odoo: OdooClient,
    private readonly inventario: InventarioService,
    private readonly operaciones: OperacionesService,
    private readonly clientes: ClientesService,
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
  async crearPedidoDesdeItems(
    asesorId: string,
    itemsSolicitados: { catalogLineId: string; cantidad: number }[],
    opciones?: { clienteId?: string; formaPago?: FormaPago },
  ) {
    if (itemsSolicitados.length === 0) throw new BadRequestException('El carrito está vacío.');

    const asesor = await this.prisma.asesor.findUniqueOrThrow({ where: { id: asesorId }, include: { direcciones: true } });

    // EP-21 — validación de canal/cliente ANTES de tocar stock: falla rápido
    // sin reservar nada si el pedido no cumple las reglas de crédito.
    const requiereCliente = CANALES_CON_CREDITO.includes(asesor.canal);
    const formaPago: FormaPago = requiereCliente ? (opciones?.formaPago ?? 'CONTADO_CULQI') : 'CONTADO_CULQI';
    if (requiereCliente && formaPago !== 'CONTADO_CULQI' && !opciones?.clienteId) {
      throw new BadRequestException('Este canal requiere seleccionar un Cliente para pagar al crédito o por depósito.');
    }
    if (opciones?.clienteId) {
      const cliente = await this.prisma.cliente.findUniqueOrThrow({ where: { id: opciones.clienteId } });
      if (cliente.asesorId !== asesorId) {
        throw new BadRequestException('Este cliente no te pertenece.');
      }
    }
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

    // EP-21 — para AL_CREDITO, reservar el cupo ANTES de crear el pedido: si
    // no hay línea/cupo suficiente, falla rápido sin dejar un pedido a medio
    // armar ni tocar stock. Se libera en rechazarPedido si no prospera.
    if (formaPago === 'AL_CREDITO') {
      await this.clientes.reservarCredito(opciones!.clienteId!, totalCulqi);
    }

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
        clienteId: opciones?.clienteId,
        formaPago,
        depositoEstado: formaPago === 'CONTADO_DEPOSITO' ? 'PENDIENTE_VALIDACION' : undefined,
        items: { create: items },
      },
      include: { items: true },
    });
    try {
      await this.reservarOCancelar(order.id);
    } catch (e) {
      // Si no había stock, el pedido ya quedó CANCELADO_DEVUELTO (reservarOCancelar)
      // — hay que devolver el cupo de crédito reservado arriba, si correspondía.
      if (formaPago === 'AL_CREDITO') {
        await this.clientes.liberarCredito(opciones!.clienteId!, totalCulqi);
      }
      throw e;
    }

    // AL_CREDITO no pasa por Culqi ni por validación manual — el crédito ya
    // se comprometió arriba, así que el pedido queda confirmado de una vez
    // (mismo efecto que validarPagoManual, sin la revisión humana previa
    // porque quien autoriza el crédito ya fue GERENTE_COMERCIAL al aprobar
    // la línea, no en cada pedido puntual).
    if (formaPago === 'AL_CREDITO') {
      const pagado = await this.prisma.order.update({
        where: { id: order.id },
        data: { estado: EstadoPedido.PAGADO, pagadoEn: new Date() },
        include: { items: true },
      });
      await this.inventario.comprometerParaOrder(order.id);
      await this.operaciones.sincronizarEstadoPedidoAOdoo(order.id);
      return pagado;
    }

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
   * EP-21 — el Asesor carga el número de operación/banco una vez que su
   * Cliente ya hizo el depósito (dato que no existe al crear el pedido,
   * porque el depósito pasa fuera de la plataforma). No cambia el estado
   * del pedido todavía — solo deja el comprobante listo para que
   * GERENTE_COMERCIAL/FINANZAS lo valide con validarDeposito.
   */
  async registrarDeposito(orderId: string, data: { numeroOperacion: string; banco: string; comprobanteUrl?: string }) {
    const order = await this.prisma.order.findUniqueOrThrow({ where: { id: orderId } });
    if (order.formaPago !== FormaPago.CONTADO_DEPOSITO) {
      throw new BadRequestException('Este pedido no es de pago por depósito.');
    }
    if (order.estado !== EstadoPedido.PENDIENTE_PAGO) {
      throw new BadRequestException(`No se puede registrar el depósito: el pedido está en estado ${order.estado}.`);
    }
    return this.prisma.order.update({
      where: { id: orderId },
      data: {
        depositoNumeroOperacion: data.numeroOperacion,
        depositoBanco: data.banco,
        depositoComprobanteUrl: data.comprobanteUrl,
        depositoEstado: 'PENDIENTE_VALIDACION',
      },
    });
  }

  /**
   * EP-21 — confirmación humana (GERENTE_COMERCIAL/FINANZAS) de que el
   * depósito declarado por el Asesor realmente llegó — mismo criterio de
   * "no hay conciliación bancaria automática" que validarPagoManual (RF-018).
   */
  async validarDeposito(orderId: string, actorId: string) {
    const order = await this.prisma.order.findUniqueOrThrow({ where: { id: orderId } });
    if (order.formaPago !== FormaPago.CONTADO_DEPOSITO) {
      throw new BadRequestException('Este pedido no es de pago por depósito.');
    }
    if (order.estado !== EstadoPedido.PENDIENTE_PAGO) {
      throw new BadRequestException(`No se puede validar: el pedido está en estado ${order.estado}.`);
    }
    if (!order.depositoNumeroOperacion) {
      throw new BadRequestException('Todavía no se registró el número de operación del depósito (RN EP-21).');
    }

    await this.prisma.auditLog.create({
      data: { actorId, accion: 'VALIDAR_DEPOSITO', entidad: 'Order', entidadId: orderId, valoresAntes: { estado: order.estado } },
    });
    const actualizado = await this.prisma.order.update({
      where: { id: orderId },
      data: {
        estado: EstadoPedido.PAGADO,
        pagadoEn: new Date(),
        depositoEstado: 'VALIDADO',
        depositoValidadoPorId: actorId,
        depositoValidadoEn: new Date(),
      },
    });
    await this.inventario.comprometerParaOrder(orderId);
    await this.operaciones.sincronizarEstadoPedidoAOdoo(orderId);
    return actualizado;
  }

  /**
   * Validación manual del pago (RF-018 Yape): el asesor paga por Yape y un
   * gerente/administrador confirma visualmente que el monto llegó. No hay
   * webhook de Culqi conectado todavía — es una confirmación humana, no
   * una verificación automática contra la pasarela. `pagadoEn` es el punto
   * de partida del plazo de entrega (RF-030).
   */
  async validarPagoManual(orderId: string, actorId: string) {
    // Auditoría 2026-08-12 (EP-07): antes marcaba PAGADO sin importar el
    // estado previo — un pedido ya PAGADO, CANCELADO_DEVUELTO o vencido se
    // podía "re-confirmar" igual, comprometiendo stock por segunda vez.
    const order = await this.prisma.order.findUniqueOrThrow({ where: { id: orderId } });
    if (order.estado !== EstadoPedido.PENDIENTE_PAGO) {
      throw new BadRequestException(
        `No se puede validar el pago: el pedido está en estado ${order.estado}, no en PENDIENTE_PAGO.`,
      );
    }

    await this.prisma.auditLog.create({
      data: { actorId, accion: 'VALIDAR_PAGO', entidad: 'Order', entidadId: orderId, valoresAntes: { estado: order.estado } },
    });
    // TODO RF-036: una vez con credenciales reales de Odoo, encadenar
    // confirmarPagoYEnviarAOdoo aca en vez de solo marcar PAGADO.
    const actualizado = await this.prisma.order.update({ where: { id: orderId }, data: { estado: EstadoPedido.PAGADO, pagadoEn: new Date() } });
    await this.inventario.comprometerParaOrder(orderId);
    await this.operaciones.sincronizarEstadoPedidoAOdoo(orderId);
    return actualizado;
  }

  // Estados desde los que todavía tiene sentido "rechazar" el pedido entero
  // (nunca se despachó nada físico). A partir de PICKING, lo que corresponde
  // es el flujo de entrega fallida/devolución (registrarEntregaFallida en
  // OperacionesService), no este método.
  private readonly ESTADOS_RECHAZABLES: EstadoPedido[] = [EstadoPedido.PENDIENTE_PAGO, EstadoPedido.PAGADO];

  async rechazarPedido(orderId: string, actorId: string, motivo?: string) {
    // Auditoría 2026-08-12 (EP-07): antes cancelaba el pedido sin importar
    // el estado previo — se podía "rechazar" un pedido ya EN_RUTA o
    // ENTREGADO, liberando stock que no correspondía y dejando el historial
    // inconsistente con lo que realmente pasó en el almacén/reparto.
    const order = await this.prisma.order.findUniqueOrThrow({ where: { id: orderId } });
    if (!this.ESTADOS_RECHAZABLES.includes(order.estado)) {
      throw new BadRequestException(
        `No se puede rechazar: el pedido está en estado ${order.estado}. ` +
          `Si ya se despachó, usá el flujo de entrega fallida/devolución en vez de rechazar el pedido.`,
      );
    }

    await this.prisma.auditLog.create({
      data: { actorId, accion: 'RECHAZAR_PEDIDO', entidad: 'Order', entidadId: orderId, motivo, valoresAntes: { estado: order.estado } },
    });
    const actualizado = await this.prisma.order.update({ where: { id: orderId }, data: { estado: EstadoPedido.CANCELADO_DEVUELTO } });
    await this.inventario.liberarParaOrder(orderId);
    // EP-21 — si era AL_CREDITO, ese cupo ya se había comprometido contra la
    // línea del cliente al crear el pedido (crearPedidoDesdeItems); al
    // rechazarlo hay que devolverlo, si no el cliente queda con cupo
    // "fantasma" ocupado por un pedido que nunca se concretó.
    if (order.formaPago === 'AL_CREDITO' && order.clienteId) {
      await this.clientes.liberarCredito(order.clienteId, Number(order.totalCulqi));
    }
    await this.operaciones.sincronizarEstadoPedidoAOdoo(orderId);
    return actualizado;
  }

  /**
   * RF-022/RF-036: tras el pago aprobado (Culqi), confirma el pedido y lo
   * envía a Odoo. Idempotente y resumible: se puede volver a llamar en
   * cualquier momento y solo hace lo que todavía falte.
   *
   * Auditoría 2026-08-12 (EP-14, bug crítico): antes, marcar el pedido como
   * PAGADO y comprometer el stock dependía de que la sincronización con
   * Odoo funcionara — y esa sincronización SIEMPRE fallaba, porque mandaba
   * `odooProductId: 0` (un id que no existe) para cada línea. Como nada
   * atrapaba ese error, la excepción se propagaba hacia arriba: el cliente
   * quedaba cobrado de verdad por Culqi, pero el pedido nunca pasaba de
   * PENDIENTE_PAGO en nuestra base, y su reserva de stock terminaba
   * venciendo sola a los 30 min como si nadie hubiera pagado.
   *
   * Ahora: 1) confirmar el pago (marcar PAGADO + comprometer stock) NO
   * depende de Odoo — se hace apenas Culqi aprobó, sin excepción. 2) la
   * sincronización a Odoo se intenta aparte, con el SKU→producto real
   * (OdooClient.buscarProductoIdPorSku, ya existía y se usa en otro lado
   * para lo mismo); si falla (Odoo caído, SKU sin mapear, lo que sea) se
   * registra el error pero NUNCA revierte la confirmación del pago — se
   * puede reintentar después llamando esta misma función de nuevo.
   */
  async confirmarPagoYEnviarAOdoo(orderId: string) {
    let order = await this.prisma.order.findUniqueOrThrow({ where: { id: orderId }, include: { asesor: true, items: true } });

    if (order.odooSaleOrderId) {
      return order; // RF-020: ya sincronizado, no duplica
    }

    // Paso 1 — innegociable: el cliente ya pagó, el pedido tiene que
    // reflejarlo sí o sí, pase lo que pase con Odoo.
    if (order.estado !== EstadoPedido.PAGADO) {
      order = await this.prisma.order.update({
        where: { id: orderId },
        data: { estado: EstadoPedido.PAGADO },
        include: { asesor: true, items: true },
      });
      await this.inventario.comprometerParaOrder(orderId);
    }

    // Paso 2 — best-effort: si algo de esto falla, queda logueado y
    // reintentable, pero el pago de arriba ya quedó confirmado igual.
    try {
      const partnerId = await this.odoo.upsertAsesorComoPartner({
        odooPartnerId: order.asesor.odooPartnerId,
        nombre: order.asesor.codigo,
        telefono: order.asesor.telefonoPrincipal,
        dni: order.asesor.numeroDocumento,
      });

      const lineas = await Promise.all(
        order.items.map(async (i) => {
          const odooProductId = await this.odoo.buscarProductoIdPorSku(i.sku);
          if (!odooProductId) {
            throw new Error(`SKU ${i.sku} no tiene producto asociado en Odoo (default_code sin coincidencia).`);
          }
          return { odooProductId, cantidad: i.cantidad, precioUnitario: Number(i.precioAsesorUnitario) };
        }),
      );

      const odooSaleOrderId = await this.odoo.crearPedidoVenta({ partnerId, referenciaWeb: order.referenciaWeb, lineas });
      order = await this.prisma.order.update({ where: { id: orderId }, data: { odooSaleOrderId }, include: { asesor: true, items: true } });
    } catch (e) {
      // No se propaga: el pago ya está confirmado (paso 1). Esto queda para
      // que Gestión/Odoo lo reconcilie a mano — no hay cron en este
      // proyecto para reintentar solo.
      console.error(`No se pudo sincronizar a Odoo el pedido ${order.referenciaWeb} (${orderId}):`, (e as Error).message);
    }

    return order;
  }
}
