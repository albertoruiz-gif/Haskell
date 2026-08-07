// Tipos y helpers de la escala de premios por venta mensual (RF 2026-08-07).
// Ver backend/src/modules/premios/premios.service.ts para el cálculo real.

export type NivelPremio = { id: string; nombre: string; descripcion: string | null; montoMinimo: number };

export type ProgresoPremio = {
  ventaSemana: number;
  ventaDelMes: number;
  nivelActual: NivelPremio | null;
  nivelSiguiente: NivelPremio | null;
  faltante: number | null;
};

export type PuntoSeriePremio = { etiqueta: string; venta: number; nivelActual: string | null };
export type SeriePremio = { canal: string; puntos: PuntoSeriePremio[] };

export type LogroPremio = { mes: string; nivel: string };
export type HistorialPremios = { totalPremiosGanados: number; logros: LogroPremio[] };

export const CANAL_LABEL: Record<string, string> = {
  RETAIL: 'Retail',
  SALONES_BELLEZA: 'Salones de Belleza',
  COMERCIO_MINORISTA: 'Comercio Minorista',
};

export function formatoSoles(valor: number): string {
  return `S/ ${valor.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** % de avance hacia el nivel siguiente, 0-100, para la barra de progreso. */
export function pctAvance(progreso: ProgresoPremio): number {
  if (!progreso.nivelSiguiente) return 100; // ya alcanzó el nivel más alto vigente
  const base = progreso.nivelActual?.montoMinimo ?? 0;
  const rango = progreso.nivelSiguiente.montoMinimo - base;
  if (rango <= 0) return 100;
  return Math.min(100, Math.max(0, Math.round(((progreso.ventaDelMes - base) / rango) * 100)));
}
