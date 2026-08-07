'use client';

// Pestaña genérica Comercial/Finanzas/Operaciones/Marketing digital — las
// cuatro tienen la misma forma (cards de indicadores + gráfica de
// composición por canal), solo cambia el endpoint y el título de la
// gráfica. Evita repetir el mismo componente 4 veces.

import { useEffect, useState } from 'react';
import { apiFetch, ApiError } from '../../lib/api';
import { ErrorBanner } from '../ui/ErrorBanner';
import { IndicadorCard } from './IndicadorCard';
import { DrillDownPanel } from './DrillDownPanel';
import { GraficaComposicion } from './GraficaComposicion';
import type { ValorIndicador } from '../../lib/indicadores';

export function TabIndicadores({ endpoint, tituloComposicion }: { endpoint: string; tituloComposicion?: string }) {
  const [datos, setDatos] = useState<ValorIndicador[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);
  const [seleccionado, setSeleccionado] = useState<ValorIndicador | null>(null);

  useEffect(() => {
    setCargando(true);
    apiFetch<ValorIndicador[]>(endpoint)
      .then(setDatos)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'No se pudo cargar el indicador.'))
      .finally(() => setCargando(false));
  }, [endpoint]);

  return (
    <div className="space-y-3">
      <ErrorBanner mensaje={error} />
      {cargando && <p className="text-xs text-bosque/50">Cargando…</p>}

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {datos.map((d) => (
          <IndicadorCard key={d.indicador} dato={d} onClick={() => setSeleccionado(d)} />
        ))}
      </div>

      {tituloComposicion && <GraficaComposicion titulo={tituloComposicion} datos={null} />}

      {seleccionado && <DrillDownPanel dato={seleccionado} onClose={() => setSeleccionado(null)} />}
    </div>
  );
}
