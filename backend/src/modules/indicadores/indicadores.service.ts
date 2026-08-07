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

// Los 6 indicadores que hoy calculan de verdad (ver comentario de clase) —
// son los únicos para los que tiene sentido pedir /indicadores/serie.
const INDICADORES_CON_SERIE = [
  'ventas_netas',
  'ticket_promedio',
  'venta_promedio_asesor_activo',
  'cumplimiento_meta',
  'pedidos_completos_a_tiempo',
  'tiempo_ciclo_pedido',
] as const;

const PERIODOS_VALIDOS = ['dia', 'semana', 'mes', 'bimestre', 'trimestre', 'semestre', 'anio'] as const;
type PeriodoId = (typeof PERIODOS_VALIDOS)[number];

const DIAS_POR_PERIODO: Partial<Record<PeriodoId, number>> = { dia: 1, semana: 7 };
const MESES_POR_PERIODO: Partial<Record<PeriodoId, number>> = { mes: 1, bimestre: 2, trimestre: 3, semestre: 6, anio: 12 };
const MESES_ABREV = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

type Bucket = { desde: Date; hasta: Date; etiqueta: string };

/**
 * Agrega, por pestaña del tablero gerencial, el valor actual de cada
 * indicador junto con su meta vigente (tabla MetaIndicador).
 *
 * Estado (2026-08-07): la parte de metas es real. De los 17 indicadores,
 * 6 ya calculan un valorActual real a partir de datos 100% propios (Order/
 * Entrega en Postgres, sin Odoo) — ver INDICADORES_CON_SERIE arriba. Los
 * otros 11 dependen de datos que hoy solo viven en Odoo (margen/costo/
 * inventario contable) o de piezas que todavía no existen (CAC, LTV — ver
 * indicadores.constants.ts) y quedan en null a propósito: preferible
 * mostrar "pendiente de cálculo" que inventar una fórmula sin validar
 * contra la instancia real de Odoo.
 *
 * `comercial()`/`operaciones()` calculan el snapshot del mes calendario
 * actual; `serieHistorica()` reusa el mismo cálculo por rango de fechas
 * para armar la serie que consume el panel de detalle del frontend
 * (selector de período + gráfica de línea con meta).
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

  /**
   * `canal` (opcional, uno de CANALES en indicadores.constants.ts) desglosa
   * los 4 indicadores calculables por canal — Order.canal ya existe en cada
   * pedido, no hace falta ningún dato nuevo. La meta usada es la específica
   * de ese canal si existe (MetaIndicador.canal), si no cae a la global —
   * ver armarValor/metaVigenteEn.
   */
  async comercial(canal?: string | null): Promise<ValorIndicador[]> {
    const { desde, hasta } = this.rangoMesActual();
    const metas = await this.metasVigentes(INDICADORES_COMERCIALES);
    const claves = ['ventas_netas', 'ticket_promedio', 'venta_promedio_asesor_activo', 'cumplimiento_meta'] as const;
    const valores: Partial<Record<IndicadorKey, number | null>> = {};
    for (const indicador of claves) {
      valores[indicador] = await this.valorEnRango(indicador, desde, hasta, canal ?? null);
    }
    return INDICADORES_COMERCIALES.map((indicador) => this.armarValor(indicador, metas, valores[indicador] ?? null, canal ?? null));
  }

  /**
   * "Ventas por canal" (gráfica de composición de la pestaña Comercial) —
   * ventas_netas del mes actual para cada uno de los 3 canales reales.
   */
  async ventasPorCanal(): Promise<{ canal: string; valor: number }[]> {
    const { desde, hasta } = this.rangoMesActual();
    const canales = ['SALONES_BELLEZA', 'RETAIL', 'COMERCIO_MINORISTA'];
    const resultado = [];
    for (const canal of canales) {
      const valor = await this.valorEnRango('ventas_netas', desde, hasta, canal);
      resultado.push({ canal, valor: valor ?? 0 });
    }
    return resultado;
  }

  async finanzas(): Promise<ValorIndicador[]> {
    const metas = await this.metasVigentes(INDICADORES_FINANCIEROS);
    return INDICADORES_FINANCIEROS.map((indicador) => this.armarValor(indicador, metas));
  }

  async operaciones(): Promise<ValorIndicador[]> {
    const { desde, hasta } = this.rangoMesActual();
    const metas = await this.metasVigentes(INDICADORES_OPERATIVOS);
    const valores: Partial<Record<IndicadorKey, number | null>> = {
      pedidos_completos_a_tiempo: await this.valorEnRango('pedidos_completos_a_tiempo', desde, hasta),
      tiempo_ciclo_pedido: await this.valorEnRango('tiempo_ciclo_pedido', desde, hasta),
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

  /**
   * Serie histórica de un indicador para el panel de detalle (drill-down)
   * del frontend — selector Día/Semana/Mes/Bimestre/Trimestre/Semestre/Año.
   * La meta de cada punto es la que estaba vigente AL FINAL de ese período
   * (MetaIndicador.vigenciaDesde/vigenciaHasta), no la meta actual — así la
   * línea de referencia refleja objetivos que cambiaron con el tiempo.
   * Para los 11 indicadores que todavía no calculan nada real, devuelve la
   * serie igual pero con valorActual null en todos los puntos (el frontend
   * ya sabe mostrar "pendiente de cálculo" para eso).
   */
  async serieHistorica(indicadorCrudo: string, periodoCrudo: string, cantidadCruda: number) {
    const periodo: PeriodoId = (PERIODOS_VALIDOS as readonly string[]).includes(periodoCrudo) ? (periodoCrudo as PeriodoId) : 'mes';
    const cantidad = Math.min(Math.max(Math.trunc(cantidadCruda) || 12, 1), 36);
    const buckets = this.generarBuckets(periodo, cantidad);
    const esCalculable = (INDICADORES_CON_SERIE as readonly string[]).includes(indicadorCrudo);

    const puntos = [];
    for (const b of buckets) {
      const valorActual = esCalculable ? await this.valorEnRango(indicadorCrudo as IndicadorKey, b.desde, b.hasta) : null;
      const meta = await this.metaVigenteEn(indicadorCrudo, b.hasta);
      puntos.push({
        etiqueta: b.etiqueta,
        valorActual: valorActual !== null ? Math.round(valorActual * 100) / 100 : null,
        meta,
      });
    }
    return { indicador: indicadorCrudo, periodo, puntos };
  }

  // --- Cálculo por rango de fechas, compartido entre el snapshot del mes
  // actual (comercial/operaciones) y la serie histórica. ---

  private async valorEnRango(indicador: IndicadorKey, desde: Date, hasta: Date, canal: string | null = null): Promise<number | null> {
    switch (indicador) {
      case 'ventas_netas': {
        const pedidos = await this.ordenesPagadasEnRango(desde, hasta, canal);
        return pedidos.length > 0 ? this.sumarVentaPvp(pedidos) : null;
      }
      case 'ticket_promedio': {
        const pedidos = await this.ordenesPagadasEnRango(desde, hasta, canal);
        return pedidos.length > 0 ? this.sumarVentaPvp(pedidos) / pedidos.length : null;
      }
      case 'venta_promedio_asesor_activo': {
        const pedidos = await this.ordenesPagadasEnRango(desde, hasta, canal);
        const asesoresActivos = new Set(pedidos.map((p) => p.asesorId)).size;
        return asesoresActivos > 0 ? this.sumarVentaPvp(pedidos) / asesoresActivos : null;
      }
      case 'cumplimiento_meta': {
        const pedidos = await this.ordenesPagadasEnRango(desde, hasta, canal);
        if (pedidos.length === 0) return null;
        const metaVentas = await this.metaVigenteEn('ventas_netas', hasta, canal);
        return metaVentas ? (this.sumarVentaPvp(pedidos) / metaVentas) * 100 : null;
      }
      case 'pedidos_completos_a_tiempo':
        return (await this.calcularOperativosEnRango(desde, hasta, canal)).pctATiempo;
      case 'tiempo_ciclo_pedido':
        return (await this.calcularOperativosEnRango(desde, hasta, canal)).cicloDias;
      default:
        return null;
    }
  }

  private async calcularOperativosEnRango(
    desde: Date,
    hasta: Date,
    canal: string | null = null,
  ): Promise<{ pctATiempo: number | null; cicloDias: number | null }> {
    const entregados = await this.prisma.order.findMany({
      where: { estado: 'ENTREGADO', pagadoEn: { gte: desde, lte: hasta }, ...(canal ? { canal: canal as never } : {}) },
      include: { entrega: true },
    });
    const conEntrega = entregados.filter((o) => o.entrega && o.pagadoEn);
    if (conEntrega.length === 0) return { pctATiempo: null, cicloDias: null };

    const aTiempo = conEntrega.filter(
      (o) =>
        calcularEstadoSaludEntrega({
          pagadoEn: o.pagadoEn,
          entregaEstado: o.entrega!.estado,
          entregaUpdatedAt: o.entrega!.updatedAt,
        }) === 'A_TIEMPO',
    ).length;

    const diasTotales = conEntrega.reduce((acc, o) => acc + (o.entrega!.updatedAt.getTime() - o.pagadoEn!.getTime()) / (1000 * 60 * 60 * 24), 0);

    return { pctATiempo: (aTiempo / conEntrega.length) * 100, cicloDias: diasTotales / conEntrega.length };
  }

  private rangoMesActual(): { desde: Date; hasta: Date } {
    const ahora = new Date();
    const desde = new Date(ahora.getFullYear(), ahora.getMonth(), 1, 0, 0, 0, 0);
    return { desde, hasta: ahora };
  }

  private async ordenesPagadasEnRango(desde: Date, hasta: Date, canal: string | null = null) {
    return this.prisma.order.findMany({
      where: {
        pagadoEn: { gte: desde, lte: hasta },
        estado: { not: 'CANCELADO_DEVUELTO' },
        ...(canal ? { canal: canal as never } : {}),
      },
      include: { items: true },
    });
  }

  private sumarVentaPvp(pedidos: { items: { pvpUnitario: unknown; cantidad: number }[] }[]): number {
    return pedidos.reduce((acc, p) => acc + p.items.reduce((s, i) => s + Number(i.pvpUnitario) * i.cantidad, 0), 0);
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

  // Meta vigente en una fecha puntual (para la serie histórica) — a
  // diferencia de metasVigentes() (vigente HOY), esta mira vigenciaDesde/
  // vigenciaHasta contra la fecha pedida, así la línea de meta de un
  // período viejo refleja el objetivo que regía en ese momento. Si se pide
  // un canal y no hay meta específica para ese canal, cae a la meta global.
  private async metaVigenteEn(indicador: string, fecha: Date, canal: string | null = null): Promise<number | null> {
    const meta = await this.prisma.metaIndicador.findFirst({
      where: {
        indicador,
        canal: canal as never,
        vigenciaDesde: { lte: fecha },
        OR: [{ vigenciaHasta: null }, { vigenciaHasta: { gte: fecha } }],
      },
      orderBy: { vigenciaDesde: 'desc' },
    });
    if (meta) return Number(meta.valorObjetivo);
    if (canal !== null) return this.metaVigenteEn(indicador, fecha, null);
    return null;
  }

  // Meta específica del canal si existe, si no la global — mismo criterio
  // de fallback que metaVigenteEn pero contra la lista ya cargada en memoria
  // (metasVigentes), para no repetir consultas en comercial()/operaciones().
  private armarValor(
    indicador: IndicadorKey,
    metas: Map<string, MetaVigente[]>,
    valorActual: number | null = null,
    canal: string | null = null,
  ): ValorIndicador {
    const lista = metas.get(indicador);
    const metaDelCanal = canal ? lista?.find((m) => m.canal === canal) : undefined;
    const metaGlobal = lista?.find((m) => m.canal === null);
    return {
      indicador,
      valorActual: valorActual !== null ? Math.round(valorActual * 100) / 100 : null,
      meta: (metaDelCanal ?? metaGlobal)?.valor ?? null,
      canal,
    };
  }

  // --- Buckets de la serie histórica ---

  private generarBuckets(periodo: PeriodoId, cantidad: number): Bucket[] {
    const ahora = new Date();
    const buckets: Bucket[] = [];

    const dias = DIAS_POR_PERIODO[periodo];
    if (dias) {
      for (let i = cantidad - 1; i >= 0; i--) {
        const hasta = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate() - dias * i, 23, 59, 59, 999);
        const desde = new Date(hasta);
        desde.setDate(desde.getDate() - dias + 1);
        desde.setHours(0, 0, 0, 0);
        buckets.push({ desde, hasta, etiqueta: this.etiquetaBucket(desde, hasta, periodo) });
      }
      return buckets;
    }

    const meses = MESES_POR_PERIODO[periodo] ?? 1;
    for (let i = cantidad - 1; i >= 0; i--) {
      const offsetFin = ahora.getMonth() - meses * i;
      const desde = new Date(ahora.getFullYear(), offsetFin - meses + 1, 1, 0, 0, 0, 0);
      const hasta = new Date(ahora.getFullYear(), offsetFin + 1, 0, 23, 59, 59, 999);
      buckets.push({ desde, hasta, etiqueta: this.etiquetaBucket(desde, hasta, periodo) });
    }
    return buckets;
  }

  private etiquetaBucket(desde: Date, hasta: Date, periodo: PeriodoId): string {
    if (periodo === 'dia') return `${hasta.getDate()} ${MESES_ABREV[hasta.getMonth()]}`;
    if (periodo === 'semana') return `${desde.getDate()} ${MESES_ABREV[desde.getMonth()]} - ${hasta.getDate()} ${MESES_ABREV[hasta.getMonth()]}`;
    if (periodo === 'anio') return `${hasta.getFullYear()}`;
    if (desde.getMonth() === hasta.getMonth() && desde.getFullYear() === hasta.getFullYear()) {
      return `${MESES_ABREV[hasta.getMonth()]} ${hasta.getFullYear()}`;
    }
    return `${MESES_ABREV[desde.getMonth()]}-${MESES_ABREV[hasta.getMonth()]} ${hasta.getFullYear()}`;
  }
}
