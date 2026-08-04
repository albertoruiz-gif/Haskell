import { Injectable, Logger } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';
import { SecretsService } from '../../config/secrets.service';

/**
 * Cliente generico JSON-RPC para Odoo 19 Online (API externa JSON-2).
 * Decision de arquitectura (ver docs/ARQUITECTURA.md): la web consulta y
 * escribe en Odoo por esta via — no hay webhooks salientes de Odoo porque
 * el plan Online no permite modulos con codigo custom. No requiere VPN:
 * Odoo Online expone un endpoint HTTPS publico.
 *
 * Multi-compañia: esta cuenta Odoo tiene varias compañias (Haskell_Distribuidor,
 * Haskell_Perú, Efficax Solutions SA). Cada llamada de execute() se ancla via
 * contexto (allowed_company_ids/company_id) a ODOO_COMPANY_ID — ver ese metodo.
 * A proposito NO se agrega un filtro de dominio ['company_id','=',X] automatico
 * en searchRead: varios modelos (product.product, res.partner) suelen tener
 * registros "compartidos" con company_id=False, y un filtro asi los ocultaria
 * de golpe. Si algun metodo especifico necesita excluir explicitamente otras
 * compañias en una lectura, se agrega el domain puntual en ese metodo.
 */
@Injectable()
export class OdooClient {
  private readonly logger = new Logger(OdooClient.name);
  private http!: AxiosInstance;
  private uid: number | null = null;

  constructor(private readonly secrets: SecretsService) {}

  private async client(): Promise<AxiosInstance> {
    if (!this.http) {
      const { url } = this.secrets.odoo();
      this.http = axios.create({ baseURL: url, timeout: 15000 });
    }
    return this.http;
  }

  private async authenticate(): Promise<number> {
    if (this.uid) return this.uid;
    const { db, username, apiKey } = this.secrets.odoo();
    const http = await this.client();
    const { data } = await http.post('/jsonrpc', {
      jsonrpc: '2.0',
      method: 'call',
      params: {
        service: 'common',
        method: 'authenticate',
        args: [db, username, apiKey, {}],
      },
    });
    if (!data.result) throw new Error('No se pudo autenticar contra Odoo — revisá usuario/API key.');
    const uid: number = data.result;
    this.uid = uid;
    return uid;
  }

  private async execute<T>(model: string, method: string, args: unknown[], kwargs: Record<string, unknown> = {}): Promise<T> {
    const uid = await this.authenticate();
    const { db, apiKey, companyId } = this.secrets.odoo();
    const http = await this.client();
    // Ancla TODA llamada (lectura o escritura) a la compañia configurada
    // (ODOO_COMPANY_ID), sin depender de cual sea la compañia por defecto
    // del usuario tecnico en ese momento. allowed_company_ids limita que
    // compañias puede "ver" la llamada; company_id fija bajo cual compañia
    // se crean los registros nuevos (create/write). Si el caller ya mandaba
    // su propio context, se respeta y solo se completa lo que falte.
    const contextPrevio = (kwargs.context as Record<string, unknown>) ?? {};
    const kwargsConCompania: Record<string, unknown> = {
      ...kwargs,
      context: {
        allowed_company_ids: [companyId],
        company_id: companyId,
        ...contextPrevio,
      },
    };
    const { data } = await http.post('/jsonrpc', {
      jsonrpc: '2.0',
      method: 'call',
      params: {
        service: 'object',
        method: 'execute_kw',
        args: [db, uid, apiKey, model, method, args, kwargsConCompania],
      },
    });
    if (data.error) {
      this.logger.error(`Odoo error en ${model}.${method}: ${JSON.stringify(data.error)}`);
      throw new Error(`Error Odoo (${model}.${method}): ${data.error.data?.message ?? data.error.message}`);
    }
    return data.result as T;
  }

  searchRead<T>(model: string, domain: unknown[], fields: string[]): Promise<T[]> {
    return this.execute<T[]>(model, 'search_read', [domain], { fields });
  }

  create(model: string, values: Record<string, unknown>): Promise<number> {
    return this.execute<number>(model, 'create', [values]);
  }

  write(model: string, ids: number[], values: Record<string, unknown>): Promise<boolean> {
    return this.execute<boolean>(model, 'write', [ids, values]);
  }

  unlink(model: string, ids: number[]): Promise<boolean> {
    return this.execute<boolean>(model, 'unlink', [ids]);
  }

  // --- Mapeos por dominio (tabla 8.2 del RFD) ---

  /** Odoo -> Web: maestro de productos, para sincronizar contra CatalogLine.sku */
  obtenerProductos(soloActivos = true) {
    return this.searchRead<{ id: number; default_code: string; name: string; list_price: number }>(
      'product.product',
      soloActivos ? [['active', '=', true]] : [],
      ['id', 'default_code', 'name', 'list_price'],
    );
  }

  /** Odoo -> Web: stock disponible por producto (RF-013) */
  obtenerStock(productIds: number[]) {
    return this.searchRead<{ product_id: [number, string]; quantity: number; reserved_quantity: number }>(
      'stock.quant',
      [['product_id', 'in', productIds], ['location_id.usage', '=', 'internal']],
      ['product_id', 'quantity', 'reserved_quantity'],
    );
  }

  /** Web -> Odoo: crea/actualiza el contacto del asesor (res.partner) */
  async upsertAsesorComoPartner(asesor: { odooPartnerId?: number | null; nombre: string; email?: string; telefono: string; dni: string }) {
    const values = {
      name: asesor.nombre,
      email: asesor.email,
      phone: asesor.telefono,
      vat: asesor.dni,
      customer_rank: 1,
    };
    if (asesor.odooPartnerId) {
      await this.write('res.partner', [asesor.odooPartnerId], values);
      return asesor.odooPartnerId;
    }
    return this.create('res.partner', values);
  }

  /** Web -> Odoo: crea el pedido de venta tras el pago aprobado (RF-036) */
  async crearPedidoVenta(params: {
    partnerId: number;
    referenciaWeb: string;
    lineas: { odooProductId: number; cantidad: number; precioUnitario: number }[];
    envioOdooProductId?: number;
    envioPrecio?: number;
  }) {
    const orderLines: unknown[] = params.lineas.map((l) => [
      0,
      0,
      { product_id: l.odooProductId, product_uom_qty: l.cantidad, price_unit: l.precioUnitario },
    ]);
    if (params.envioOdooProductId) {
      orderLines.push([0, 0, { product_id: params.envioOdooProductId, product_uom_qty: 1, price_unit: params.envioPrecio ?? 0 }]);
    }
    const saleOrderId = await this.create('sale.order', {
      partner_id: params.partnerId,
      client_order_ref: params.referenciaWeb,
      order_line: orderLines,
    });
    return saleOrderId;
  }

  /** Odoo -> Web: estado de picking asociado a un pedido (RN-021, bidireccional) */
  obtenerPicking(saleOrderId: number) {
    return this.searchRead<{ id: number; state: string; name: string }>(
      'stock.picking',
      [['sale_id', '=', saleOrderId]],
      ['id', 'state', 'name'],
    );
  }

  confirmarPicking(pickingId: number) {
    return this.execute<boolean>('stock.picking', 'button_validate', [[pickingId]]);
  }

  /** Odoo -> Web: comprobante electronico asociado al pedido */
  obtenerComprobante(saleOrderId: number) {
    return this.searchRead<{ id: number; name: string; state: string; l10n_latam_document_number: string }>(
      'account.move',
      [['invoice_origin', '=', saleOrderId]],
      ['id', 'name', 'state', 'l10n_latam_document_number'],
    );
  }

  // --- Ofertas -> Odoo (ver catalogo-haskell/PROMPT_trasladar_ofertas_a_odoo.md) ---

  private pricelistOfertasId: number | null = null;

  /** Id de la pricelist "Ofertas vigentes" (creada a mano una vez en Odoo) — se cachea en memoria. */
  private async obtenerPricelistOfertasId(): Promise<number> {
    if (this.pricelistOfertasId) return this.pricelistOfertasId;
    const listas = await this.searchRead<{ id: number }>('product.pricelist', [['name', '=', 'Ofertas vigentes']], ['id']);
    if (!listas[0]) {
      throw new Error('No existe la lista de precios "Ofertas vigentes" en Odoo — crearla antes de sincronizar ofertas.');
    }
    this.pricelistOfertasId = listas[0].id;
    return this.pricelistOfertasId;
  }

  /** Id de product.product por código HSK-xxxx (default_code), o null si no existe en Odoo. */
  async buscarProductoIdPorSku(sku: string): Promise<number | null> {
    const productos = await this.searchRead<{ id: number }>('product.product', [['default_code', '=', sku]], ['id']);
    return productos[0]?.id ?? null;
  }

  /**
   * Web -> Odoo: crea el product.pricelist.item que refleja una oferta
   * activa de la plataforma, con precio fijo y vigencia por fecha — para que
   * facturación/Hasky/reportes en Odoo lean el precio real sin depender de
   * esta plataforma. Devuelve el id del pricelist.item (se guarda en
   * Offer.odooPricelistItemId para poder desactivarlo después).
   */
  async crearItemPricelistOferta(params: { sku: string; precioEfectivo: number; inicio: Date; fin: Date }): Promise<number> {
    const productId = await this.buscarProductoIdPorSku(params.sku);
    if (!productId) {
      throw new Error(`No se encontró en Odoo un producto con código ${params.sku} — no se pudo reflejar la oferta.`);
    }
    const pricelistId = await this.obtenerPricelistOfertasId();
    return this.create('product.pricelist.item', {
      pricelist_id: pricelistId,
      applied_on: '0_product_variant',
      product_id: productId,
      compute_price: 'fixed',
      fixed_price: params.precioEfectivo,
      date_start: params.inicio.toISOString().slice(0, 10),
      date_end: params.fin.toISOString().slice(0, 10),
    });
  }

  /**
   * Web -> Odoo: retira el pricelist.item de una oferta desactivada o
   * borrada. product.pricelist.item no tiene campo "active" en esta
   * instancia (Odoo 19) — hay que eliminarlo (unlink), no desactivarlo.
   */
  eliminarItemPricelist(id: number): Promise<boolean> {
    return this.unlink('product.pricelist.item', [id]);
  }

  // --- Delivery -> Odoo (ver catalogo-haskell/PROMPT_sync_delivery_a_odoo.md) ---

  /** Web -> Odoo: crea/actualiza el contacto del transportista (res.partner, proveedor de servicio — se le factura al pagarle). */
  async upsertTransportistaComoPartner(transportista: { odooPartnerId?: number | null; nombre: string; telefono: string }) {
    const values = {
      name: transportista.nombre,
      phone: transportista.telefono,
      supplier_rank: 1,
      company_type: 'person',
    };
    if (transportista.odooPartnerId) {
      await this.write('res.partner', [transportista.odooPartnerId], values);
      return transportista.odooPartnerId;
    }
    return this.create('res.partner', values);
  }

  private tipoOperacionEntregaCache: { id: number; locationId: number; locationDestId: number } | null = null;

  /**
   * Tipo de operacion de salida del Almacen Central - Los Olivos — todas las
   * entregas se reflejan bajo este almacen por ahora (la plataforma todavia
   * no distingue desde que almacen fisico sale cada pedido; el Almacen
   * Periferico - San Borja existe en Odoo pero no se usa aca todavia).
   */
  private async obtenerTipoOperacionEntrega() {
    if (this.tipoOperacionEntregaCache) return this.tipoOperacionEntregaCache;
    const tipos = await this.searchRead<{
      id: number;
      default_location_src_id: [number, string];
      default_location_dest_id: [number, string];
    }>(
      'stock.picking.type',
      [
        // "code = outgoing" no alcanza para distinguir: el TPV/POS tambien
        // registra un tipo de salida con ese mismo code — hay que pedir
        // puntualmente "Órdenes de entrega" (Delivery Orders), no cualquier salida.
        ['code', '=', 'outgoing'],
        ['name', '=', 'Órdenes de entrega'],
        ['warehouse_id.name', '=', 'Almacén Central - Los Olivos'],
      ],
      ['id', 'default_location_src_id', 'default_location_dest_id'],
    );
    if (!tipos[0]) {
      throw new Error('No existe el tipo de operación de salida del Almacén Central - Los Olivos en Odoo.');
    }
    this.tipoOperacionEntregaCache = {
      id: tipos[0].id,
      locationId: tipos[0].default_location_src_id[0],
      locationDestId: tipos[0].default_location_dest_id[0],
    };
    return this.tipoOperacionEntregaCache;
  }

  /**
   * Web -> Odoo: espejo de solo lectura del estado de Delivery de un pedido
   * en un stock.picking (crea si no existe, actualiza si ya existe —
   * matcheando por x_pedido_externo_id, el numero de pedido legible
   * HSK_CANAL_NNNNNN). La plataforma sigue siendo la fuente de verdad.
   */
  async sincronizarDeliveryAOdoo(params: {
    pedidoExternoId: string;
    clientePartnerId?: number | null;
    transportistaPartnerId?: number | null;
    scheduledDate?: Date | null;
    dateDone?: Date | null;
    enTransito?: boolean;
    recibidoNombre?: string | null;
    recibidoDni?: string | null;
    devueltoCausa?: string | null;
    estadoDelivery?: string | null;
  }): Promise<number> {
    const values: Record<string, unknown> = {
      x_transportista_id: params.transportistaPartnerId ?? false,
      x_en_transito: params.enTransito ?? false,
      x_recibido_nombre: params.recibidoNombre ?? false,
      x_recibido_dni: params.recibidoDni ?? false,
      x_devuelto_causa: params.devueltoCausa ?? false,
      x_estado_delivery: params.estadoDelivery ?? false,
    };
    if (params.scheduledDate) values.scheduled_date = params.scheduledDate.toISOString().slice(0, 19).replace('T', ' ');
    if (params.dateDone) values.date_done = params.dateDone.toISOString().slice(0, 19).replace('T', ' ');
    if (params.clientePartnerId) values.partner_id = params.clientePartnerId;

    const existentes = await this.searchRead<{ id: number }>(
      'stock.picking',
      [['x_pedido_externo_id', '=', params.pedidoExternoId]],
      ['id'],
    );
    if (existentes[0]) {
      await this.write('stock.picking', [existentes[0].id], values);
      return existentes[0].id;
    }

    const tipo = await this.obtenerTipoOperacionEntrega();
    return this.create('stock.picking', {
      ...values,
      x_pedido_externo_id: params.pedidoExternoId,
      picking_type_id: tipo.id,
      location_id: tipo.locationId,
      location_dest_id: tipo.locationDestId,
    });
  }
}
