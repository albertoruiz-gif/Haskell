import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../config/prisma.service';
import { OdooClient } from '../odoo/odoo.client';
import {
  INDICADORES_COMERCIALES,
  INDICADORES_FINANCIEROS,
  INDICADORES_MARKETING_DIGITAL,
  INDICADORES_OPERATIVOS,
  IndicadorKey,
} from './indicadores.constants';

type MetaVigente = { valor: number; canal: string | null };

type ValorIndicador = {
  indicador: IndicadorKey;
  valorActual: number | null; // null = todavía no calculado, ver TODOs de esta clase
  meta: number | null;
  canal: string | null;
};

/**
 * Agrega, por pestaña del tablero gerencial, el valor actual de cada
 * indicador junto con su meta vigente (tabla MetaIndicador).
 *
 * Estado: la parte de metas ya es real (lee MetaIndicador). El valorActual
 * de cada indicador queda en null a propósito — calcularlo bien requiere
 * validar el domain/campos exactos contra la instancia real de Odoo
 * (ventas, margen, inventario) o contra las tablas propias (Order, Entrega,
 * Payment) para lo operativo web. Recomendado: probar cada consulta primero
 * con el servidor mcp-odoo-server antes de cablearla acá, indicador por
 * indicador, en vez de asumir nombres de campo.
 */
@Injectable()
export class IndicadoresService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly odoo: OdooClient,
  ) {}

  async gerencial() {
    const [comercial, finanzas] = await Promise.all([this.comercial(), this.finanzas()]);
    return { comercial, finanzas };
  }

  async comercial(): Promise<ValorIndicador[]> {
    const metas = await this.metasVigentes(INDICADORES_COMERCIALES);
    return INDICADORES_COMERCIALES.map((indicador) => this.armarValor(indicador, metas));
  }

  async finanzas(): Promise<ValorIndicador[]> {
    const metas = await this.metasVigentes(INDICADORES_FINANCIEROS);
    return INDICADORES_FINANCIEROS.map((indicador) => this.armarValor(indicador, metas));
  }

  async operaciones(): Promise<ValorIndicador[]> {
    const metas = await this.metasVigentes(INDICADORES_OPERATIVOS);
    return INDICADORES_OPERATIVOS.map((indicador) => this.armarValor(indicador, metas));
  }

  /**
   * Marketing digital (ltv_cliente, cac) — sumados 2026-08-06. valorActual
   * queda en null para los dos: cac necesita GastoMarketing con datos reales
   * cargados + una fuente confiable de "clientes nuevos" del período (todavía
   * sin definir); ltv_cliente depende de la Fase 3 de Hasky (cartera por
   * cliente, hoy solo diseñada) y solo aplicaría a Salones/Retail. Ver
   * comentario en indicadores.constants.ts.
   */
  async marketing(): Promise<ValorIndicador[]> {
    const metas = await this.metasVigentes(INDICADORES_MARKETING_DIGITAL);
    return INDICADORES_MARKETING_DIGITAL.map((indicador) => this.armarValor(indicador, metas));
  }

  private async metasVigentes(indicadores: readonly string[]): Promise<Map<string, MetaVigente[]>> {
    const metas = await this.prisma.metaIndicador.findMany({
      where: {
        indicador: { in: indicadores as string[] },
        OR: [{ vigenciaHasta: null }, { vigenciaHasta: { gt: new Date() } }],
      },
    });
    const porIndicador = new Map<string, MetaVigente[]>();
    for (const m of metas) {
      const lista = porIndicador.get(m.indicador) ?? [];
      lista.push({ valor: Number(m.valorObjetivo), canal: m.canal });
      porIndicador.set(m.indicador, lista);
    }
    return porIndicador;
  }

  private armarValor(indicador: IndicadorKey, metas: Map<string, MetaVigente[]>): ValorIndicador {
    const metaGlobal = metas.get(indicador)?.find((m) => m.canal === null);
    return {
      indicador,
      valorActual: null,
      meta: metaGlobal?.valor ?? null,
      canal: null,
    };
  }

  // --- Cálculo real por indicador — ir destapando uno por uno a medida que
  // se valide contra Odoo/DB propia. Dejar el resto en null es preferible a
  // inventar un domain o fórmula sin confirmar contra la instancia real. ---

  /**
   * ventas_netas: candidato de consulta — sumar sale.order.amount_total con
   * domain [['state','in',['sale','done']], ['date_order','>=',desde],
   * ['date_order','<=',hasta]]. Falta confirmar: si "ventas netas" para
   * Haskell debe excluir el costo de envío, si los descuentos ya vienen
   * aplicados en amount_total, y si conviene filtrar por company_id acá
   * también (OdooClient.execute ya lo ancla vía contexto). Probar primero
   * con una tool nueva en mcp-odoo-server antes de habilitar este método.
   */
  private async ventasNetas(_desde: Date, _hasta: Date): Promise<number> {
    throw new Error('ventasNetas: no implementado — validar el domain contra Odoo antes de habilitar.');
  }
}
