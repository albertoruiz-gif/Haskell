import 'dotenv/config';
import axios, { AxiosInstance } from 'axios';
import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

/**
 * Servidor MCP standalone para Odoo (Haskell_Distribuidor).
 *
 * Mismo protocolo JSON-RPC que backend/src/modules/odoo/odoo.client.ts,
 * reimplementado sin dependencia de NestJS para poder correr como proceso
 * independiente (stdio) que cualquier cliente MCP — Claude Desktop, Claude
 * Code, Cowork — puede invocar.
 *
 * No reemplaza al backend: el backend sigue siendo la fuente de verdad para
 * la web. Este servidor es un canal adicional de solo-lectura + escrituras
 * puntuales (hoy: registrar venta perdida) pensado para que un asistente de
 * IA (Hasky u otro) opere sobre Odoo con permisos acotados y explícitos.
 */

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Falta la variable de entorno ${name} — revisá el archivo .env (ver .env.example).`);
  }
  return value;
}

class OdooClient {
  private readonly http: AxiosInstance;
  private uid: number | null = null;

  private readonly db = requireEnv('ODOO_DB');
  private readonly username = requireEnv('ODOO_USERNAME');
  private readonly apiKey = requireEnv('ODOO_API_KEY');
  private readonly companyId = Number(requireEnv('ODOO_COMPANY_ID'));

  constructor() {
    this.http = axios.create({ baseURL: requireEnv('ODOO_URL'), timeout: 15000 });
  }

  private async authenticate(): Promise<number> {
    if (this.uid) return this.uid;
    const { data } = await this.http.post('/jsonrpc', {
      jsonrpc: '2.0',
      method: 'call',
      params: {
        service: 'common',
        method: 'authenticate',
        args: [this.db, this.username, this.apiKey, {}],
      },
    });
    if (!data.result) {
      throw new Error('No se pudo autenticar contra Odoo — revisá ODOO_USERNAME / ODOO_API_KEY.');
    }
    this.uid = data.result as number;
    return this.uid;
  }

  private async execute<T>(
    model: string,
    method: string,
    args: unknown[],
    kwargs: Record<string, unknown> = {},
  ): Promise<T> {
    const uid = await this.authenticate();
    const contextPrevio = (kwargs.context as Record<string, unknown>) ?? {};
    const kwargsConCompania: Record<string, unknown> = {
      ...kwargs,
      context: {
        allowed_company_ids: [this.companyId],
        company_id: this.companyId,
        ...contextPrevio,
      },
    };
    const { data } = await this.http.post('/jsonrpc', {
      jsonrpc: '2.0',
      method: 'call',
      params: {
        service: 'object',
        method: 'execute_kw',
        args: [this.db, uid, this.apiKey, model, method, args, kwargsConCompania],
      },
    });
    if (data.error) {
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
}

const odoo = new OdooClient();

const server = new McpServer({ name: 'hasky-odoo-mcp', version: '0.1.0' });

server.tool(
  'buscar_productos',
  'Busca productos del catálogo Haskell en Odoo por nombre o código (default_code). Devuelve id, código, nombre y precio de lista en soles.',
  {
    termino: z.string().describe('Texto a buscar en el nombre o código del producto'),
  },
  async ({ termino }) => {
    const productos = await odoo.searchRead<{
      id: number;
      default_code: string;
      name: string;
      list_price: number;
    }>(
      'product.product',
      ['|', ['name', 'ilike', termino], ['default_code', 'ilike', termino]],
      ['id', 'default_code', 'name', 'list_price'],
    );
    return { content: [{ type: 'text', text: JSON.stringify(productos, null, 2) }] };
  },
);

server.tool(
  'consultar_stock',
  'Consulta el stock disponible (cantidad y reservado) de uno o más productos por su id de Odoo (product.product). Usar primero buscar_productos para obtener los ids.',
  {
    productIds: z.array(z.number()).describe('Ids de product.product a consultar'),
  },
  async ({ productIds }) => {
    const stock = await odoo.searchRead<{
      product_id: [number, string];
      quantity: number;
      reserved_quantity: number;
    }>(
      'stock.quant',
      [
        ['product_id', 'in', productIds],
        ['location_id.usage', '=', 'internal'],
      ],
      ['product_id', 'quantity', 'reserved_quantity'],
    );
    return { content: [{ type: 'text', text: JSON.stringify(stock, null, 2) }] };
  },
);

server.tool(
  'registrar_venta_perdida',
  'Crea una oportunidad en el CRM de Odoo para registrar una venta perdida, según el diseño acordado de Hasky (Variante A): "Sin stock Perú" si el producto existe en el catálogo pero no hay stock, "No disponible en Perú" si el producto no existe en el catálogo Perú. Nunca pedir datos de la clienta final.',
  {
    asesor: z.string().describe('Nombre del asesor que reportó la venta perdida'),
    producto: z.string().describe('Nombre del producto solicitado'),
    motivo: z.enum(['Sin stock Perú', 'No disponible en Perú']).describe('Motivo de la venta perdida'),
    cantidad: z.number().optional().describe('Cantidad solicitada, solo si el asesor la dio espontáneamente'),
  },
  async ({ asesor, producto, motivo, cantidad }) => {
    const titulo = motivo === 'Sin stock Perú' ? `Venta perdida: ${producto}` : `Solicitud no disponible: ${producto}`;
    const leadId = await odoo.create('crm.lead', {
      name: titulo,
      type: 'lead',
      description: [
        `Asesor: ${asesor}`,
        `Producto: ${producto}`,
        `Motivo: ${motivo}`,
        cantidad ? `Cantidad: ${cantidad}` : null,
      ]
        .filter(Boolean)
        .join('\n'),
    });
    return { content: [{ type: 'text', text: `Lead creado en CRM con id ${leadId} (motivo: ${motivo}).` }] };
  },
);

const transport = new StdioServerTransport();
await server.connect(transport);
