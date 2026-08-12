'use client';

// Pestaña "Configuración" de Gestión — EP-16/EP-06/EP-09: hasta ahora el
// tiempo de reserva de stock estaba fijo en el código (30 min). Esta
// pantalla queda pensada para crecer con otros parámetros configurables
// (tolerancia de conciliación de vouchers, etc.) sin agregar una pestaña
// nueva por cada uno.

import { useEffect, useState } from 'react';
import { apiFetch, ApiError } from '../../lib/api';
import { ErrorBanner } from '../ui/ErrorBanner';

type Configuracion = { minutosReservaStock: number; updatedAt: string };

export function ConfiguracionTab() {
  const [config, setConfig] = useState<Configuracion | null>(null);
  const [minutos, setMinutos] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [guardadoOk, setGuardadoOk] = useState(false);

  async function cargar() {
    try {
      const data = await apiFetch<Configuracion>('/configuracion');
      setConfig(data);
      setMinutos(String(data.minutosReservaStock));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo cargar la configuración.');
    }
  }

  useEffect(() => {
    cargar();
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setGuardadoOk(false);
    setGuardando(true);
    try {
      const data = await apiFetch<Configuracion>('/configuracion', {
        method: 'PATCH',
        body: { minutosReservaStock: Number(minutos) },
      });
      setConfig(data);
      setGuardadoOk(true);
      setTimeout(() => setGuardadoOk(false), 2500);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo guardar.');
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="max-w-md space-y-3 rounded-card bg-white p-4 shadow-sm">
      <div>
        <h2 className="text-sm font-medium text-bosque">Reserva de stock</h2>
        <p className="mt-1 text-xs text-bosque/60">
          Cuando un pedido queda pendiente de pago, el stock se reserva por esta cantidad de minutos. Si nadie paga a
          tiempo, la reserva se libera sola y el producto vuelve a estar disponible para otra persona.
        </p>
      </div>

      <ErrorBanner mensaje={error} />

      <form onSubmit={onSubmit} className="flex items-end gap-2">
        <label className="flex-1 text-xs text-bosque/70">
          Minutos de reserva
          <input
            type="number"
            min={5}
            max={1440}
            value={minutos}
            onChange={(e) => setMinutos(e.target.value)}
            className="mt-1 w-full rounded-pill border border-musgo/30 px-3 py-2 text-sm outline-none focus:border-acento"
          />
        </label>
        <button
          type="submit"
          disabled={guardando}
          className="rounded-pill bg-bosque px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {guardando ? 'Guardando…' : 'Guardar'}
        </button>
      </form>

      {guardadoOk && <p className="text-xs font-medium text-musgo-dark">✓ Guardado.</p>}
      {config && (
        <p className="text-xs text-bosque/50">
          Última actualización: {new Date(config.updatedAt).toLocaleString('es-PE')}
        </p>
      )}
    </div>
  );
}
