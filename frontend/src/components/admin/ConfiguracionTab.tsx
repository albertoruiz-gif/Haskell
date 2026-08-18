'use client';

// Pestaña "Configuración" de Gestión — EP-16/EP-06/EP-09: hasta ahora el
// tiempo de reserva de stock estaba fijo en el código (30 min). Esta
// pantalla queda pensada para crecer con otros parámetros configurables
// (tolerancia de conciliación de vouchers, etc.) sin agregar una pestaña
// nueva por cada uno.

import { useEffect, useState } from 'react';
import { apiFetch, ApiError } from '../../lib/api';
import { ErrorBanner } from '../ui/ErrorBanner';

type Configuracion = {
  minutosReservaStock: number;
  toleranciaConciliacionSoles: number;
  featureFlags: Record<string, boolean>;
  updatedAt: string;
};

export function ConfiguracionTab() {
  const [config, setConfig] = useState<Configuracion | null>(null);
  const [minutos, setMinutos] = useState('');
  const [tolerancia, setTolerancia] = useState('');
  const [flags, setFlags] = useState<Record<string, boolean>>({});
  const [nuevaClave, setNuevaClave] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [guardadoOk, setGuardadoOk] = useState(false);

  async function cargar() {
    try {
      const data = await apiFetch<Configuracion>('/configuracion');
      setConfig(data);
      setMinutos(String(data.minutosReservaStock));
      setTolerancia(String(data.toleranciaConciliacionSoles));
      setFlags(data.featureFlags ?? {});
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo cargar la configuración.');
    }
  }

  useEffect(() => {
    cargar();
  }, []);

  async function guardar(cambios: { minutosReservaStock?: number; toleranciaConciliacionSoles?: number; featureFlags?: Record<string, boolean> }) {
    setError(null);
    setGuardadoOk(false);
    setGuardando(true);
    try {
      const data = await apiFetch<Configuracion>('/configuracion', { method: 'PATCH', body: cambios });
      setConfig(data);
      setFlags(data.featureFlags ?? {});
      setGuardadoOk(true);
      setTimeout(() => setGuardadoOk(false), 2500);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo guardar.');
    } finally {
      setGuardando(false);
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    await guardar({ minutosReservaStock: Number(minutos), toleranciaConciliacionSoles: Number(tolerancia) });
  }

  function toggleFlag(clave: string) {
    const actualizados = { ...flags, [clave]: !flags[clave] };
    setFlags(actualizados);
    guardar({ featureFlags: actualizados });
  }

  function eliminarFlag(clave: string) {
    const actualizados = { ...flags };
    delete actualizados[clave];
    setFlags(actualizados);
    guardar({ featureFlags: actualizados });
  }

  function agregarFlag(e: React.FormEvent) {
    e.preventDefault();
    const clave = nuevaClave.trim();
    if (!clave || clave in flags) return;
    const actualizados = { ...flags, [clave]: false };
    setFlags(actualizados);
    setNuevaClave('');
    guardar({ featureFlags: actualizados });
  }

  return (
    <div className="max-w-md space-y-6 rounded-card bg-white p-4 shadow-sm">
      <div>
        <h2 className="text-sm font-medium text-bosque">Reserva de stock</h2>
        <p className="mt-1 text-xs text-bosque/60">
          Cuando un pedido queda pendiente de pago, el stock se reserva por esta cantidad de minutos. Si nadie paga a
          tiempo, la reserva se libera sola y el producto vuelve a estar disponible para otra persona.
        </p>
      </div>

      <ErrorBanner mensaje={error} />

      <form onSubmit={onSubmit} className="space-y-3">
        <label className="block text-xs text-bosque/70">
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

        <div>
          <h2 className="text-sm font-medium text-bosque">Tolerancia de conciliación</h2>
          <p className="mt-1 text-xs text-bosque/60">
            Margen en soles aceptado entre el monto que el Asesor declara haber depositado y el total real del
            pedido. Si la diferencia supera este monto, Gerencia Comercial/Finanzas no podrá validar el depósito
            (RN EP-21) hasta que se corrija.
          </p>
          <label className="mt-1 block text-xs text-bosque/70">
            Tolerancia (S/)
            <input
              type="number"
              min={0}
              step="0.01"
              value={tolerancia}
              onChange={(e) => setTolerancia(e.target.value)}
              className="mt-1 w-full rounded-pill border border-musgo/30 px-3 py-2 text-sm outline-none focus:border-acento"
            />
          </label>
        </div>

        <button
          type="submit"
          disabled={guardando}
          className="rounded-pill bg-bosque px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {guardando ? 'Guardando…' : 'Guardar'}
        </button>
      </form>

      <div>
        <h2 className="text-sm font-medium text-bosque">Interruptores (feature flags)</h2>
        <p className="mt-1 text-xs text-bosque/60">
          Encienden o apagan funciones del sistema sin necesidad de un despliegue nuevo. Cada cambio se guarda de
          inmediato.
        </p>
        <ul className="mt-2 space-y-1">
          {Object.entries(flags).map(([clave, activo]) => (
            <li key={clave} className="flex items-center justify-between gap-2 rounded-pill border border-musgo/20 px-3 py-1.5 text-sm">
              <label className="flex flex-1 items-center gap-2 text-bosque">
                <input type="checkbox" checked={activo} onChange={() => toggleFlag(clave)} disabled={guardando} />
                {clave}
              </label>
              <button
                type="button"
                onClick={() => eliminarFlag(clave)}
                disabled={guardando}
                className="text-xs text-bosque/40 hover:text-acento disabled:opacity-50"
                aria-label={`Eliminar ${clave}`}
              >
                ✕
              </button>
            </li>
          ))}
          {Object.keys(flags).length === 0 && <li className="text-xs text-bosque/40">Todavía no hay interruptores creados.</li>}
        </ul>
        <form onSubmit={agregarFlag} className="mt-2 flex gap-2">
          <input
            placeholder="nombre_del_interruptor"
            value={nuevaClave}
            onChange={(e) => setNuevaClave(e.target.value)}
            className="flex-1 rounded-pill border border-musgo/30 px-3 py-1.5 text-xs outline-none focus:border-acento"
          />
          <button
            type="submit"
            disabled={guardando || !nuevaClave.trim()}
            className="rounded-pill bg-musgo px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
          >
            Agregar
          </button>
        </form>
      </div>

      {guardadoOk && <p className="text-xs font-medium text-musgo-dark">✓ Guardado.</p>}
      {config && (
        <p className="text-xs text-bosque/50">
          Última actualización: {new Date(config.updatedAt).toLocaleString('es-PE')}
        </p>
      )}
    </div>
  );
}
