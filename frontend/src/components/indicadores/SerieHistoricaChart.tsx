'use client';

// Gráfica de línea del panel de detalle — serie real (GET /indicadores/serie)
// para los 6 indicadores que ya calculan de verdad; para el resto el
// backend devuelve la misma serie con valorActual null en todos los
// puntos, y acá se muestra el estado "pendiente de cálculo" en vez de un
// gráfico vacío. La meta se dibuja como línea punteada gris — es la meta
// que estaba vigente en CADA período, no la de hoy (ver
// IndicadoresService.metaVigenteEn).

import { useEffect, useState } from 'react';
import { Brush, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { apiFetch, ApiError } from '../../lib/api';
import { formatearEje, formatearValor, infoIndicador } from '../../lib/indicadores';
import { PendienteCalculo } from './PendienteCalculo';

const PERIODO_A_ID: Record<string, string> = {
  Día: 'dia',
  Semana: 'semana',
  Mes: 'mes',
  Bimestre: 'bimestre',
  Trimestre: 'trimestre',
  Semestre: 'semestre',
  Año: 'anio',
};

type PuntoSerie = { etiqueta: string; valorActual: number | null; meta: number | null };
type RespuestaSerie = { indicador: string; periodo: string; puntos: PuntoSerie[] };

export function SerieHistoricaChart({ indicador, periodo, cantidad = 12 }: { indicador: string; periodo: string; cantidad?: number }) {
  const [serie, setSerie] = useState<RespuestaSerie | null>(null);
  const [error, setError] = useState<string | null>(null);
  const periodoId = PERIODO_A_ID[periodo] ?? 'mes';

  useEffect(() => {
    setSerie(null);
    setError(null);
    apiFetch<RespuestaSerie>(`/indicadores/serie?indicador=${indicador}&periodo=${periodoId}&cantidad=${cantidad}`)
      .then(setSerie)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'No se pudo cargar la serie histórica.'));
  }, [indicador, periodoId, cantidad]);

  if (error) return <PendienteCalculo mensaje={error} />;
  if (!serie) return <p className="py-8 text-center text-xs text-bosque/40">Cargando…</p>;

  const hayDatos = serie.puntos.some((p) => p.valorActual !== null);
  if (!hayDatos) return <PendienteCalculo mensaje={`Sin datos por ${periodo.toLowerCase()} todavía`} />;

  const { unidad } = infoIndicador(indicador);

  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={serie.puntos} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#1F4A2E" strokeOpacity={0.08} />
        <XAxis dataKey="etiqueta" tick={{ fontSize: 11, fill: '#1F4A2E' }} />
        <YAxis tick={{ fontSize: 11, fill: '#1F4A2E' }} tickFormatter={(v: number) => formatearEje(v, unidad)} width={70} />
        <Tooltip formatter={(valor: number) => formatearValor(valor, unidad)} />
        <Line type="monotone" dataKey="valorActual" name="Valor" stroke="#1F4A2E" strokeWidth={2} dot={{ r: 3 }} connectNulls />
        <Line type="monotone" dataKey="meta" name="Meta" stroke="#8A9A4E" strokeWidth={1.5} strokeDasharray="5 4" dot={false} connectNulls />
        <Brush dataKey="etiqueta" height={20} stroke="#1F4A2E" travellerWidth={8} />
      </LineChart>
    </ResponsiveContainer>
  );
}
