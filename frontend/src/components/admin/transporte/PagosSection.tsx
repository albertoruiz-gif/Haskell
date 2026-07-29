'use client';

import { useEffect, useState } from 'react';
import { apiFetch, ApiError } from '../../../lib/api';
import { ErrorBanner } from '../../ui/ErrorBanner';

type PagoEntrega = {
  id: string;
  montoPago: string | null;
  pagado: boolean;
  pagadoEn: string | null;
  updatedAt: string;
  transportistaId: string;
  transportista: { user: { nombre: string } };
  order: { referenciaWeb: string };
};

type Transportista = { id: string; efectividad: number | null; totalEntregas: number };

const EFECTIVIDAD_MINIMA = 90;

export function PagosSection() {
  const [entregas, setEntregas] = useState<PagoEntrega[]>([]);
  const [transportistas, setTransportistas] = useState<Transportista[]>([]);
  const [soloPendientes, setSoloPendientes] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);

  async function cargar() {
    setCargando(true);
    setError(null);
    try {
      const qs = soloPendientes ? '?pagado=false' : '';
      const [data, transp] = await Promise.all([
        apiFetch<PagoEntrega[]>(`/operaciones/pagos-transportista${qs}`),
        apiFetch<Transportista[]>('/transportistas'),
      ]);
      setEntregas(data);
      setTransportistas(transp);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo cargar los pagos.');
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [soloPendientes]);

  async function marcarPagado(id: string) {
    setError(null);
    try {
      await apiFetch(`/operaciones/entregas/${id}/marcar-pagado`, { method: 'PATCH' });
      await cargar();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo marcar como pagado.');
    }
  }

  const totalesPorTransportista = entregas.reduce<Record<string, { total: number; transportistaId: string }>>((acc, e) => {
    const nombre = e.transportista.user.nombre;
    acc[nombre] = { total: (acc[nombre]?.total ?? 0) + Number(e.montoPago ?? 0), transportistaId: e.transportistaId };
    return acc;
  }, {});

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between rounded-card bg-white p-3 shadow-sm">
        <p className="text-sm font-medium text-bosque">Pagos a transportistas</p>
        <label className="flex items-center gap-2 text-xs text-bosque/60">
          <input type="checkbox" checked={soloPendientes} onChange={(e) => setSoloPendientes(e.target.checked)} />
          Solo pendientes
        </label>
      </div>

      <ErrorBanner mensaje={error} />
      {cargando && <p className="text-xs text-bosque/50">Cargando…</p>}

      {soloPendientes && Object.keys(totalesPorTransportista).length > 0 && (
        <div className="rounded-card bg-musgo/10 p-3">
          <p className="text-xs font-medium uppercase text-bosque/60">Total pendiente por transportista</p>
          {Object.entries(totalesPorTransportista).map(([nombre, info]) => {
            const t = transportistas.find((x) => x.id === info.transportistaId);
            return (
              <div key={nombre} className="flex items-center justify-between text-sm text-bosque">
                <span>
                  {nombre}
                  {t?.efectividad !== null && t?.efectividad !== undefined && (
                    <span className={`ml-2 text-xs font-medium ${t.efectividad >= EFECTIVIDAD_MINIMA ? 'text-musgo-dark' : 'text-red-600'}`}>
                      ({t.efectividad}% efectividad{t.efectividad < EFECTIVIDAD_MINIMA ? ' ⚠' : ''})
                    </span>
                  )}
                </span>
                <span className="font-medium">S/ {info.total.toFixed(2)}</span>
              </div>
            );
          })}
        </div>
      )}

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {entregas.map((e) => (
          <div key={e.id} className="rounded-card bg-white p-3 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">{e.transportista.user.nombre}</p>
                <p className="text-xs text-bosque/60">Pedido {e.order.referenciaWeb} · S/ {Number(e.montoPago ?? 0).toFixed(2)}</p>
              </div>
              {e.pagado ? (
                <span className="rounded-pill bg-bosque px-3 py-1 text-xs font-medium text-white">Pagado</span>
              ) : (
                <button onClick={() => marcarPagado(e.id)} className="rounded-pill bg-acento px-3 py-1 text-xs font-medium text-white">
                  Marcar pagado
                </button>
              )}
            </div>
          </div>
        ))}
        {!cargando && entregas.length === 0 && <p className="text-xs text-bosque/50">No hay entregas para mostrar.</p>}
      </div>
    </div>
  );
}
