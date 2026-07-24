import { Injectable, Logger } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';
import { SecretsService } from '../../config/secrets.service';

/**
 * Cliente generico JSON-RPC para Odoo 19 Online (API externa JSON-2).
 * Decision de arquitectura (ver docs/ARQUITECTURA.md): la web consulta y
 * escribe en Odoo por esta via — no hay webhooks salientes de Odoo porque
 * el plan Online no permite modulos con codigo custom. No requiere VPN:
 * Odoo Online expone un endpoint HTTPS publico.
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
    const { db, apiKey } = this.secrets.odoo();
    const http = await this.client();
    const { data } = await http.post('/jsonrpc', {
      jsonrpc: '2.0',
      method: 'call',
      params: {
        service: 'object',
        method: 'execute_kw',
        args: [db, uid, apiKey, model, method, args, kwargs],
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
}
