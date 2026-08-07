'use client';

// Pestaña "Premios" de Gestión — el Gerente Comercial/Administrador arma la
// escala de premios por venta mensual, una por canal (RF 2026-08-07). Editar
// un nivel no lo sobrescribe: el backend cierra el vigente y crea uno nuevo
// (mismo criterio que Metas), así los meses pasados siguen mostrando la
// escala que realmente estaba activa entonces.

import { useEffect, useState } from 'react';
import { apiFetch, ApiError } from '../../lib/api';
import { CANAL_LABEL, formatoSoles, type NivelPremio } from '../../lib/premios';
import { ErrorBanner } from '../ui/ErrorBanner';

const CANALES = ['RETAIL', 'SALONES_BELLEZA', 'COMERCIO_MINORISTA'];

const FORM_INICIAL = { nombre: '', descripcion: '', montoMinimo: '' };

export function PremiosTab() {
  const [canal, setCanal] = useState(CANALES[0]);
  const [niveles, setNiveles] = useState<NivelPremio[]>([]);
  const [form, setForm] = useState(FORM_INICIAL);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  async function cargar() {
    try {
      const data = await apiFetch<NivelPremio[]>(`/premios/niveles?canal=${canal}`);
      setNiveles(data.slice().sort((a, b) => a.montoMinimo - b.montoMinimo));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo cargar la escala de premios.');
    }
  }

  useEffect(() => {
    cargar();
    setEditandoId(null);
    setForm(FORM_INICIAL);
  }, [canal]);

  function editar(nivel: NivelPremio) {
    setEditandoId(nivel.id);
    setForm({ nombre: nivel.nombre, descripcion: nivel.descripcion ?? '', montoMinimo: String(nivel.montoMinimo) });
  }

  function cancelarEdicion() {
    setEditandoId(null);
    setForm(FORM_INICIAL);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setGuardando(true);
    const body = { nombre: form.nombre, descripcion: form.descripcion || undefined, montoMinimo: Number(form.montoMinimo) };
    try {
      if (editandoId) {
        await apiFetch(`/premios/niveles/${editandoId}`, { method: 'PATCH', body });
      } else {
        await apiFetch('/premios/niveles', { method: 'POST', body: { ...body, canal } });
      }
      setForm(FORM_INICIAL);
      setEditandoId(null);
      await cargar();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo guardar el nivel.');
    } finally {
      setGuardando(false);
    }
  }

  async function retirar(id: string) {
    setError(null);
    try {
      await apiFetch(`/premios/niveles/${id}`, { method: 'DELETE' });
      await cargar();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo retirar el nivel.');
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {CANALES.map((c) => (
          <button
            key={c}
            onClick={() => setCanal(c)}
            className={canal === c ? 'rounded-pill bg-acento px-4 py-2 text-sm font-medium text-white' : 'rounded-pill bg-crema px-4 py-2 text-sm text-bosque'}
          >
            {CANAL_LABEL[c] ?? c}
          </button>
        ))}
      </div>

      <div className="lg:grid lg:grid-cols-[320px_1fr] lg:items-start lg:gap-4 lg:space-y-0 space-y-3">
        <form onSubmit={onSubmit} className="space-y-2 rounded-card bg-white p-3 shadow-sm">
          <p className="text-sm font-medium text-bosque">{editandoId ? 'Editar nivel' : 'Nuevo nivel'} — {CANAL_LABEL[canal]}</p>
          <input
            required
            placeholder="Nombre del premio (ej. Kit de bienvenida)"
            value={form.nombre}
            onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
            className="w-full rounded-pill border border-musgo/30 px-3 py-2 text-sm"
          />
          <input
            placeholder="Descripción (opcional)"
            value={form.descripcion}
            onChange={(e) => setForm((f) => ({ ...f, descripcion: e.target.value }))}
            className="w-full rounded-pill border border-musgo/30 px-3 py-2 text-sm"
          />
          <input
            required
            type="number"
            min="0"
            step="0.01"
            placeholder="Venta mínima del mes (S/)"
            value={form.montoMinimo}
            onChange={(e) => setForm((f) => ({ ...f, montoMinimo: e.target.value }))}
            className="w-full rounded-pill border border-musgo/30 px-3 py-2 text-sm"
          />
          <ErrorBanner mensaje={error} />
          <div className="flex gap-2">
            {editandoId && (
              <button type="button" onClick={cancelarEdicion} className="w-full rounded-pill bg-crema py-2 text-sm font-medium text-bosque">
                Cancelar
              </button>
            )}
            <button type="submit" disabled={guardando} className="w-full rounded-pill bg-bosque py-2 text-sm font-medium text-white disabled:opacity-60">
              {guardando ? 'Guardando…' : editandoId ? 'Guardar cambios' : 'Agregar nivel'}
            </button>
          </div>
        </form>

        <div className="space-y-2">
          {niveles.length === 0 && (
            <p className="rounded-card bg-white p-3 text-xs text-bosque/50 shadow-sm">
              Todavía no hay escala de premios para {CANAL_LABEL[canal]}.
            </p>
          )}
          {niveles.map((n, i) => (
            <div key={n.id} className="flex items-center justify-between rounded-card bg-white p-3 shadow-sm">
              <div>
                <p className="text-sm font-medium text-bosque">
                  Nivel {i + 1}: {n.nombre} <span className="text-xs font-normal text-bosque/50">— desde {formatoSoles(n.montoMinimo)}</span>
                </p>
                {n.descripcion && <p className="text-xs text-bosque/50">{n.descripcion}</p>}
              </div>
              <div className="flex shrink-0 gap-2">
                <button onClick={() => editar(n)} className="rounded-pill bg-crema px-3 py-1.5 text-xs font-medium text-acento">
                  Editar
                </button>
                <button onClick={() => retirar(n.id)} className="rounded-pill bg-crema px-3 py-1.5 text-xs font-medium text-red-600">
                  Retirar
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
