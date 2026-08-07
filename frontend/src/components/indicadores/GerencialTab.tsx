'use client';

import { useEffect, useState } from 'react';
import { apiFetch, ApiError } from '../../lib/api';
import { ErrorBanner } from '../ui/ErrorBanner';
import { IndicadorCard } from './IndicadorCard';
import { DrillDownPanel } from './DrillDownPanel';
import { SerieHistoricaChart } from './SerieHistoricaChart';
import { calcularEstado, ESTADO_COLOR, ESTADO_LABEL, infoIndicador, PERIODOS } from '../../lib/indicadores';
import type { Periodo, ValorIndicador } from '../../lib/indicadores';

type RespuestaGerencial = { comercial: ValorIndicador[]; finanzas: ValorIndicador[] };

// Semáforo de estado por área: "en riesgo" si algún indicador de esa área
// está en riesgo, "alerta" si alguno está en alerta y ninguno en riesgo,
// si no "a favor". Operaciones no viene en /indicadores/gerencial (el
// backend solo agrega comercial+finanzas ahí) — se pide aparte.
function estadoDeArea(datos: ValorIndicador[]) {
  const estados = datos.map((d) => calcularEstado(d.valorActual, d.meta, infoIndicador(d.indicador).menorEsMejor));
  if (estados.includes('riesgo')) return 'riesgo' as const;
  if (estados.includes('alerta')) return 'alerta' as const;
  if (estados.every((e) => e === 'pendiente' || e === 'sin_meta')) return 'pendiente' as const;
  return 'exito' as const;
}

export function GerencialTab({ onIrAPestana }: { onIrAPestana: (id: 'comercial' | 'finanzas' | 'operaciones') => void }) {
  const [datos, setDatos] = useState<RespuestaGerencial | null>(null);
  const [operaciones, setOperaciones] = useState<ValorIndicador[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [seleccionado, setSeleccionado] = useState<ValorIndicador | null>(null);
  const [periodoVentas, setPeriodoVentas] = useState<Periodo>('Mes');

  useEffect(() => {
    Promise.all([apiFetch<RespuestaGerencial>('/indicadores/gerencial'), apiFetch<ValorIndicador[]>('/indicadores/operaciones')])
      .then(([gerencial, ops]) => {
        setDatos(gerencial);
        setOperaciones(ops);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'No se pudo cargar el tablero.'));
  }, []);

  const areas: { id: 'comercial' | 'finanzas' | 'operaciones'; label: string; datos: ValorIndicador[] }[] = datos
    ? [
        { id: 'comercial', label: 'Comercial', datos: datos.comercial },
        { id: 'finanzas', label: 'Finanzas', datos: datos.finanzas },
        { id: 'operaciones', label: 'Operaciones', datos: operaciones },
      ]
    : [];

  return (
    <div className="space-y-3">
      <ErrorBanner mensaje={error} />
      {!datos && !error && <p className="text-xs text-bosque/50">Cargando…</p>}

      {datos && (
        <>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {areas.map((area) => {
              const estado = estadoDeArea(area.datos);
              return (
                <button
                  key={area.id}
                  onClick={() => onIrAPestana(area.id)}
                  className="flex items-center justify-between rounded-card bg-white p-4 text-left shadow-sm transition hover:shadow-md"
                >
                  <span className="text-sm font-medium text-bosque">{area.label}</span>
                  <span className={`flex items-center gap-1.5 rounded-pill px-2 py-1 text-xs font-medium text-white ${ESTADO_COLOR[estado]}`}>
                    {ESTADO_LABEL[estado]}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="rounded-card bg-white p-4 shadow-sm">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-medium text-bosque">Ventas netas vs meta</p>
              <select
                value={periodoVentas}
                onChange={(e) => setPeriodoVentas(e.target.value as Periodo)}
                className="rounded-pill border border-musgo/30 bg-white px-3 py-1 text-xs text-bosque"
              >
                {PERIODOS.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
            <SerieHistoricaChart indicador="ventas_netas" periodo={periodoVentas} cantidad={periodoVentas === 'Mes' ? 6 : 10} />
          </div>

          <div>
            <p className="mb-2 text-sm font-medium text-bosque">Comercial</p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {datos.comercial.map((d) => (
                <IndicadorCard key={d.indicador} dato={d} onClick={() => setSeleccionado(d)} />
              ))}
            </div>
          </div>

          <div>
            <p className="mb-2 text-sm font-medium text-bosque">Finanzas</p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {datos.finanzas.map((d) => (
                <IndicadorCard key={d.indicador} dato={d} onClick={() => setSeleccionado(d)} />
              ))}
            </div>
          </div>
        </>
      )}

      {seleccionado && <DrillDownPanel dato={seleccionado} onClose={() => setSeleccionado(null)} />}
    </div>
  );
}
