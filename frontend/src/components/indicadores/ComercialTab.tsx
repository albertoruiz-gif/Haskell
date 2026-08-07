'use client';

// Pestaña Comercial — a diferencia de Finanzas/Operaciones/Marketing (ver
// TabIndicadores, genérico), esta tiene selector de canal: los 4
// indicadores calculables (ventas_netas, ticket_promedio,
// venta_promedio_asesor_activo, cumplimiento_meta) se pueden ver globales
// o desglosados por canal, porque Order.canal ya existe en cada pedido —
// no hace falta ningún dato nuevo. La gráfica de composición usa el mismo
// desglose (ventas por canal, siempre los 3 canales juntos).

import { useEffect, useState } from 'react';
import { apiFetch, ApiError } from '../../lib/api';
import { ErrorBanner } from '../ui/ErrorBanner';
import { IndicadorCard } from './IndicadorCard';
import { DrillDownPanel } from './DrillDownPanel';
import { GraficaComposicion, type DatoComposicion } from './GraficaComposicion';
import { ProductosTopPie } from '../ui/ProductosTopPie';
import { CANAL_LABEL, CANALES } from '../../lib/indicadores';
import type { ValorIndicador } from '../../lib/indicadores';

const OPCIONES_CANAL = [{ id: null, label: 'Todos' }, ...CANALES.map((c) => ({ id: c, label: CANAL_LABEL[c] ?? c }))];

export function ComercialTab() {
  const [canal, setCanal] = useState<string | null>(null);
  const [datos, setDatos] = useState<ValorIndicador[]>([]);
  const [composicion, setComposicion] = useState<DatoComposicion[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);
  const [seleccionado, setSeleccionado] = useState<ValorIndicador | null>(null);

  useEffect(() => {
    setCargando(true);
    const query = canal ? `?canal=${canal}` : '';
    apiFetch<ValorIndicador[]>(`/indicadores/comercial${query}`)
      .then(setDatos)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'No se pudo cargar el indicador.'))
      .finally(() => setCargando(false));
  }, [canal]);

  useEffect(() => {
    apiFetch<DatoComposicion[]>('/indicadores/comercial/ventas-por-canal')
      .then(setComposicion)
      .catch(() => setComposicion(null));
  }, []);

  return (
    <div className="space-y-3">
      <ErrorBanner mensaje={error} />

      <div className="flex flex-wrap gap-1">
        {OPCIONES_CANAL.map((op) => (
          <button
            key={op.label}
            onClick={() => setCanal(op.id)}
            className={
              canal === op.id
                ? 'rounded-pill bg-acento px-3 py-1 text-xs font-medium text-white'
                : 'rounded-pill bg-crema px-3 py-1 text-xs text-bosque'
            }
          >
            {op.label}
          </button>
        ))}
      </div>

      {cargando && <p className="text-xs text-bosque/50">Cargando…</p>}

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {datos.map((d) => (
          <IndicadorCard key={d.indicador} dato={d} onClick={() => setSeleccionado(d)} />
        ))}
      </div>

      <GraficaComposicion titulo="Ventas por canal" datos={composicion} unidad="moneda" />

      <ProductosTopPie endpoint="/indicadores/productos-top" titulo="Productos más vendidos (mes actual)" />

      {seleccionado && <DrillDownPanel dato={seleccionado} onClose={() => setSeleccionado(null)} />}
    </div>
  );
}
