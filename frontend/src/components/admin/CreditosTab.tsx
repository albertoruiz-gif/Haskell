'use client';

// EP-21 — bandeja de aprobación de línea de crédito (solo GERENTE_COMERCIAL/
// ADMINISTRADOR, tal como el backend lo exige): la aprobación SIEMPRE la
// resuelve Gerencia Comercial, nunca el propio Asesor ni de forma automática.

import { useEffect, useState } from 'react';
import { apiFetch, ApiError } from '../../lib/api';
import { ErrorBanner } from '../ui/ErrorBanner';

type Cliente = {
  id: string;
  razonSocialONombre: string;
  numeroDocumento: string;
  canal: string;
  estado: string;
  lineaCreditoAprobada: string | null;
  saldoUtilizado: string;
};

type Solicitud = {
  id: string;
  clienteId: string;
  cliente: Cliente;
  lineaSolicitada: string;
  motivo: string | null;
  estado: string;
  createdAt: string;
};

export function CreditosTab() {
  const [solicitudes, setSolicitudes] = useState<Solicitud[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);
  const [montos, setMontos] = useState<Record<string, string>>({});

  async function cargar() {
    setCargando(true);
    try {
      const data = await apiFetch<Solicitud[]>('/solicitudes-credito?estado=PENDIENTE');
      setSolicitudes(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo cargar las solicitudes de crédito.');
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    cargar();
  }, []);

  async function aprobar(id: string, lineaSolicitada: string) {
    setError(null);
    const lineaAprobada = Number(montos[id] ?? lineaSolicitada);
    if (!lineaAprobada || lineaAprobada <= 0) {
      setError('Ingresá un monto válido para aprobar.');
      return;
    }
    try {
      await apiFetch(`/solicitudes-credito/${id}/aprobar`, { method: 'PATCH', body: { lineaAprobada } });
      await cargar();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo aprobar la solicitud.');
    }
  }

  async function rechazar(id: string) {
    setError(null);
    const motivoRechazo = prompt('Motivo del rechazo (opcional):') ?? undefined;
    try {
      await apiFetch(`/solicitudes-credito/${id}/rechazar`, { method: 'PATCH', body: { motivoRechazo } });
      await cargar();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo rechazar la solicitud.');
    }
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-bosque/60">
        Línea de crédito para clientes de Salones de Belleza y Retail — la aprobación queda siempre a cargo de Gerencia Comercial.
      </p>
      <ErrorBanner mensaje={error} />
      {cargando && <p className="text-xs text-bosque/50">Cargando…</p>}
      {!cargando && solicitudes.length === 0 && <p className="text-xs text-bosque/50">No hay solicitudes de crédito pendientes.</p>}

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {solicitudes.map((s) => (
          <div key={s.id} className="rounded-card bg-white p-3 shadow-sm">
            <p className="text-sm font-medium">{s.cliente.razonSocialONombre}</p>
            <p className="text-xs text-bosque/60">{s.cliente.numeroDocumento} · {s.cliente.canal}</p>
            <p className="mt-1 text-xs text-bosque/70">
              Solicita: <span className="font-medium">S/ {Number(s.lineaSolicitada).toFixed(2)}</span>
            </p>
            {s.motivo && <p className="mt-1 text-xs italic text-bosque/50">&ldquo;{s.motivo}&rdquo;</p>}

            <div className="mt-2 flex items-center gap-2">
              <span className="text-xs text-bosque/60">Aprobar por S/</span>
              <input
                type="number"
                min="0"
                step="0.01"
                placeholder={s.lineaSolicitada}
                value={montos[s.id] ?? ''}
                onChange={(e) => setMontos((m) => ({ ...m, [s.id]: e.target.value }))}
                className="w-24 rounded-pill border border-musgo/30 px-2 py-1 text-xs"
              />
            </div>
            <div className="mt-2 flex gap-2">
              <button onClick={() => aprobar(s.id, s.lineaSolicitada)} className="flex-1 rounded-pill bg-bosque py-2 text-xs font-medium text-white">
                Aprobar
              </button>
              <button onClick={() => rechazar(s.id)} className="flex-1 rounded-pill bg-crema py-2 text-xs font-medium text-acento">
                Rechazar
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
