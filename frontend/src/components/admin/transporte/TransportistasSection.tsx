'use client';

import { useEffect, useState } from 'react';
import { apiFetch, ApiError } from '../../../lib/api';
import { ErrorBanner } from '../../ui/ErrorBanner';

type Transportista = {
  id: string;
  telefono: string;
  placa: string | null;
  tarifaPorEntrega: string;
  user: { id: string; email: string; nombre: string; activo: boolean };
  efectividad: number | null;
  totalEntregas: number;
};

const EFECTIVIDAD_MINIMA = 90;

const FORM_INICIAL = { email: '', nombre: '', telefono: '', placa: '', tarifaPorEntrega: '' };

export function TransportistasSection() {
  const [transportistas, setTransportistas] = useState<Transportista[]>([]);
  const [form, setForm] = useState(FORM_INICIAL);
  const [tarifasEdit, setTarifasEdit] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  async function cargar() {
    try {
      const data = await apiFetch<Transportista[]>('/transportistas');
      setTransportistas(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo cargar los transportistas.');
    }
  }

  useEffect(() => {
    cargar();
  }, []);

  async function crear(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setGuardando(true);
    try {
      await apiFetch('/transportistas', {
        method: 'POST',
        body: { ...form, tarifaPorEntrega: Number(form.tarifaPorEntrega) },
      });
      setForm(FORM_INICIAL);
      await cargar();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo crear el transportista.');
    } finally {
      setGuardando(false);
    }
  }

  async function guardarTarifa(id: string) {
    const valor = tarifasEdit[id];
    if (!valor) return;
    setError(null);
    try {
      await apiFetch(`/transportistas/${id}/tarifa`, { method: 'PATCH', body: { tarifaPorEntrega: Number(valor) } });
      await cargar();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo actualizar la tarifa.');
    }
  }

  async function toggleActivo(userId: string, activo: boolean) {
    setError(null);
    try {
      await apiFetch(`/auth/usuarios/${userId}/${activo ? 'desactivar' : 'reactivar'}`, { method: 'PATCH' });
      await cargar();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo actualizar el estado.');
    }
  }

  return (
    <div className="space-y-3 lg:grid lg:grid-cols-[340px_1fr] lg:items-start lg:gap-4 lg:space-y-0">
      <form onSubmit={crear} className="space-y-2 rounded-card bg-white p-3 shadow-sm">
        <p className="text-sm font-medium text-bosque">Nuevo transportista</p>
        <input required placeholder="Nombre" value={form.nombre} onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))} className="w-full rounded-pill border border-musgo/30 px-3 py-2 text-sm" />
        <input required type="email" placeholder="Email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} className="w-full rounded-pill border border-musgo/30 px-3 py-2 text-sm" />
        <div className="grid grid-cols-2 gap-2">
          <input required placeholder="Teléfono" value={form.telefono} onChange={(e) => setForm((f) => ({ ...f, telefono: e.target.value }))} className="rounded-pill border border-musgo/30 px-3 py-2 text-sm" />
          <input placeholder="Placa (opcional)" value={form.placa} onChange={(e) => setForm((f) => ({ ...f, placa: e.target.value }))} className="rounded-pill border border-musgo/30 px-3 py-2 text-sm" />
        </div>
        <input required type="number" step="0.01" placeholder="Pago fijo por entrega (S/)" value={form.tarifaPorEntrega} onChange={(e) => setForm((f) => ({ ...f, tarifaPorEntrega: e.target.value }))} className="w-full rounded-pill border border-musgo/30 px-3 py-2 text-sm" />
        <ErrorBanner mensaje={error} />
        <button type="submit" disabled={guardando} className="w-full rounded-pill bg-bosque py-2 text-sm font-medium text-white disabled:opacity-60">
          {guardando ? 'Guardando…' : 'Crear transportista'}
        </button>
      </form>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {transportistas.map((t) => (
          <div key={t.id} className="rounded-card bg-white p-3 shadow-sm">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium">{t.user.nombre}</p>
                <p className="text-xs text-bosque/60">{t.user.email} · {t.telefono} {t.placa && <>· {t.placa}</>}</p>
              </div>
              <span className={`rounded-pill px-3 py-1 text-xs font-medium ${t.user.activo ? 'bg-bosque text-white' : 'bg-red-100 text-red-700'}`}>
                {t.user.activo ? 'Activo' : 'Inactivo'}
              </span>
            </div>
            {t.efectividad !== null && (
              <p className={`mt-1 text-xs font-medium ${t.efectividad >= EFECTIVIDAD_MINIMA ? 'text-musgo-dark' : 'text-red-600'}`}>
                Efectividad de entrega: {t.efectividad}% ({t.totalEntregas} entregas) {t.efectividad < EFECTIVIDAD_MINIMA && '· por debajo del mínimo (90%)'}
              </p>
            )}
            <div className="mt-2 flex gap-2">
              <input
                type="number"
                step="0.01"
                defaultValue={t.tarifaPorEntrega}
                onChange={(e) => setTarifasEdit((s) => ({ ...s, [t.id]: e.target.value }))}
                className="flex-1 rounded-pill border border-musgo/30 px-3 py-2 text-sm"
              />
              <button onClick={() => guardarTarifa(t.id)} className="rounded-pill bg-acento px-4 py-2 text-xs font-medium text-white">
                Guardar tarifa
              </button>
            </div>
            <button onClick={() => toggleActivo(t.user.id, t.user.activo)} className="mt-2 w-full rounded-pill bg-crema py-2 text-xs font-medium text-acento">
              {t.user.activo ? 'Desactivar' : 'Reactivar'}
            </button>
          </div>
        ))}
        {transportistas.length === 0 && <p className="text-xs text-bosque/50">Todavía no hay transportistas registrados.</p>}
      </div>
    </div>
  );
}
