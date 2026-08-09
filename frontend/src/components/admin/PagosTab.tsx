'use client';

// Pedidos reales pendientes de validación de pago (RF-018, Yape manual):
// el asesor paga por Yape y acá se confirma o rechaza visualmente — no hay
// cargo automático de Culqi conectado (faltan credenciales reales).

import { useEffect, useState } from 'react';
import { apiFetch, ApiError } from '../../lib/api';
import { ErrorBanner } from '../ui/ErrorBanner';

type Pedido = {
  id: string;
  referenciaWeb: string;
  estado: string;
  totalCulqi: string;
  direccionSnapshot: { distrito?: string };
  asesor: { user: { nombre: string } };
  createdAt: string;
};

const COLOR_ESTADO: Record<string, string> = {
  PENDIENTE_PAGO: 'bg-promo text-white',
  PAGADO: 'bg-bosque text-white',
  CANCELADO_DEVUELTO: 'bg-red-100 text-red-700',
};

const LABEL_ESTADO: Record<string, string> = {
  PENDIENTE_PAGO: 'Pendiente de validar',
  PAGADO: 'Validado',
  CANCELADO_DEVUELTO: 'Rechazado',
};

export function PagosTab() {
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);

  async function cargar() {
    setCargando(true);
    try {
      const data = await apiFetch<Pedido[]>('/orders');
      setPedidos(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo cargar los pedidos.');
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    cargar();
  }, []);

  async function validar(id: string) {
    setError(null);
    try {
      await apiFetch(`/orders/${id}/validar-pago`, { method: 'PATCH' });
      await cargar();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo validar el pago.');
    }
  }

  async function rechazar(id: string) {
    setError(null);
    const motivo = prompt('Motivo del rechazo (opcional):') ?? undefined;
    try {
      await apiFetch(`/orders/${id}/rechazar`, { method: 'PATCH', body: { motivo } });
      await cargar();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo rechazar el pedido.');
    }
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-bosque/60">
        El cargo por Yape ahora es automático vía Culqi — este panel es monitoreo. &ldquo;Marcar como pagado manualmente&rdquo; es
        solo para resolver casos puntuales donde el cargo automático falló.
      </p>
      <ErrorBanner mensaje={error} />
      {cargando && <p className="text-xs text-bosque/50">Cargando…</p>}
      {!cargando && pedidos.length === 0 && <p className="text-xs text-bosque/50">Todavía no hay pedidos.</p>}

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
      {pedidos.map((p) => (
        <div key={p.id} className="rounded-card bg-white p-3 shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium">Pedido {p.referenciaWeb} · {p.asesor.user.nombre}</p>
              <p className="text-xs text-bosque/60">
                {p.direccionSnapshot?.distrito ?? 'Sin distrito'} · S/ {Number(p.totalCulqi).toFixed(2)}
              </p>
            </div>
            <span className={`rounded-pill px-3 py-1 text-xs font-medium ${COLOR_ESTADO[p.estado] ?? ''}`}>
              {LABEL_ESTADO[p.estado] ?? p.estado}
            </span>
          </div>
          {p.estado === 'PENDIENTE_PAGO' && (
            <div className="mt-2 flex gap-2">
              <button onClick={() => validar(p.id)} className="flex-1 rounded-pill bg-bosque py-2 text-xs font-medium text-white">
                Marcar como pagado manualmente
              </button>
              <button onClick={() => rechazar(p.id)} className="flex-1 rounded-pill bg-crema py-2 text-xs font-medium text-acento">
                Rechazar
              </button>
            </div>
          )}
        </div>
      ))}
      </div>
    </div>
  );
}
