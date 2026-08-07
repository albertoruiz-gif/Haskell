import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../config/prisma.service';
import { OdooClient } from '../odoo/odoo.client';
import { calcularEstadoSaludEntrega } from '../../common/sla.util';
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
 * Estado (2026-08-07): la parte de metas es real. De los 17 indicadores,
 * 6 ya calculan un valorActual real a partir de datos 100% propios (Order/
 * Entrega en Postgres, sin Odoo) — ventas_netas, ticket_promedio,
 * venta_promedio_asesor_activo, cumplimiento_meta, pedidos_completos_a_tiempo
 * y tiempo_ciclo_pedido. Los otros 11 dependen de datos que hoy solo viven
 * en Odoo (margen/costo/inventario contable) o de piezas que todavía no
 * existen (CAC, LTV — ver indicadores.constants.ts) y quedan en null a
 * propósito: preferible mostrar "pendiente de cálculo" que inventar una
 * fórmula sin validar contra la instancia real de Odoo.
 *
 * El período de cálculo es el mes calendario actual (1° del mes hasta
 * ahora) — todavía no hay endpoint de serie histórica por período (ver
 * docs/PROMPT_dashboard_indicadores_frontend.md sección 2/3).
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
    const { desde, hasta } = this.rangoMesActual();
    const metas = await this.metasVigentes(INDICADORES_COMERCIALES);
    const pedidos = await this.ordenesPagadasEnRango(desde, hasta);

    const ventasNetas = this.sumarVentaPvp(pedidos);
    const ticketPromedio = pedidos.length > 0 ? ventasNetas / pedidos.length : null;
    const asesoresActivos = new Set(pedidos.map((p) => p.asesorId)).size;
    const ventaPromedioAsesorActivo = asesoresActivos > 0 ? ventasNetas / asesoresActivos : null;
    const metaVentasNetas = metas.get('ventas_netas')?.find((m) => m.canal === null)?.valor ?? null;
    const cumplimientoMeta = metaVentasNetas ? (ventasNetas / metaVentasNetas) * 100 : null;

    const valores: Partial<Record<IndicadorKey, number | null>> = {
      ventas_netas: pedidos.length > 0 ? ventasNetas : null,
      ticket_promedio: ticketPromedio,
      venta_promedio_asesor_activo: ventaPromedioAsesorActivo,
      cumplimiento_meta: cumplimientoMeta,
    };

    return INDICADORES_COMERCIALES.map((indicador) => this.armarValor(indicador, metas, valores[indicador] ?? null));
  }

  async finanzas(): Promise<ValorIndicador[]> {
    const metas = await this.metasVigentes(INDICADORES_FINANCIEROS);
    return INDICADORES_FINANCIEROS.map((indicador) => this.armarValor(indicador, metas));
  }

  async operaciones(): Promise<ValorIndicador[]> {
    const { desde, hasta } = this.rangoMesActual();
    const metas = await this.metasVigentes(INDICADORES_OPERATIVOS);

    const entregados = await this.prisma.order.findMany({
      where: { estado: 'ENTREGADO', pagadoEn: { gte: desde, lte: hasta } },
      include: { entrega: true },
    });

    let valorPedidosATiempo: number | null = null;
    let valorTiempoCiclo: number | null = null;
    const conEntrega = entregados.filter((o) => o.entrega && o.pagadoEn);
    if (conEntrega.length > 0) {
      const aTiempo = conEntrega.filter(
        (o) =>
          calcularEstadoSaludEntrega({
            pagadoEn: o.pagadoEn,
            entregaEstado: o.entrega!.estado,
            entregaUpdatedAt: o.entrega!.updatedAt,
          }) === 'A_TIEMPO',
      ).length;
      valorPedidosATiempo = (aTiempo / conEntrega.length) * 100;

      const diasTotales = conEntrega.reduce((acc, o) => {
        const dias = (o.entrega!.updatedAt.getTime() - o.pagadoEn!.getTime()) / (1000 * 60 * 60 * 24);
        return acc + dias;
      }, 0);
      valorTiempoCiclo = diasTotales / conEntrega.length;
    }

    const valores: Partial<Record<IndicadorKey, number | null>> = {
      pedidos_completos_a_tiempo: valorPedidosATiempo,
      tiempo_ciclo_pedido: valorTiempoCiclo,
    };

    return INDICADORES_OPERATIVOS.map((indicador) => this.armarValor(indicador, metas, valores[indicador] ?? null));
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

  private rangoMesActual(): { desde: Date; hasta: Date } {
    const ahora = new Date();
    const desde = new Date(ahora.getFullYear(), ahora.getMonth(), 1, 0, 0, 0, 0);
    return { desde, hasta: ahora };
  }

  private async ordenesPagadasEnRango(desde: Date, hasta: Date) {
    return this.prisma.order.findMany({
      where: { pagadoEn: { gte: desde, lte: hasta }, estado: { not: 'CANCELADO_DEVUELTO' } },
      include: { items: true },
    });
  }

  private sumarVentaPvp(pedidos: { items: { pvpUnitario: unknown; cantidad: number }[] }[]): number {
    return pedidos.reduce(
      (acc, p) => acc + p.items.reduce((s, i) => s + Number(i.pvpUnitario) * i.cantidad, 0),
      0,
    );
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

  private armarValor(indicador: IndicadorKey, metas: Map<string, MetaVigente[]>, valorActual: number | null = null): ValorIndicador {
    const metaGlobal = metas.get(indicador)?.find((m) => m.canal === null);
    return {
      indicador,
      valorActual: valorActual !== null ? Math.round(valorActual * 100) / 100 : null,
      meta: metaGlobal?.valor ?? null,
      canal: null,
    };
  }
}
