'use client';

import { useState } from 'react';
import { apiFetch, ApiError } from '../../lib/api';
import { ErrorBanner } from '../ui/ErrorBanner';
import { LineaAdmin } from './EditarProductoModal';

const ALCANCES = ['DIA', 'SEMANA', 'MES'];

type Props = {
  catalogoId: string;
  lineas: LineaAdmin[];
  onClose: () => void;
  onCreada: () => void;
};

export function NuevaOfertaModal({ catalogoId, lineas, onClose, onCreada }: Props) {
  const [busqueda, setBusqueda] = useState('');
  const [producto, setProducto] = useState<LineaAdmin | null>(null);
  const [alcance, setAlcance] = useState(ALCANCES[0]);
  const [descuentoPct, setDescuentoPct] = useState('');
  const [precioFijo, setPrecioFijo] = useState('');
  const [inicio, setInicio] = useState('');
  const [fin, setFin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  const resultados = busqueda.trim()
    ? lineas.filter((l) => `${l.nombre ?? ''} ${l.sku}`.toLowerCase().includes(busqueda.trim().toLowerCase())).slice(0, 8)
    : [];

  async function crear(e: React.FormEvent) {
    e.preventDefault();
    if (!producto) {
      setError('Elegí un producto para la oferta.');
      return;
    }
    setError(null);
    setGuardando(true);
    try {
      await apiFetch('/campaigns/ofertas', {
        method: 'POST',
        body: {
          catalogId: catalogoId,
          catalogLineId: producto.id,
          alcance,
          descuentoPct: descuentoPct ? Number(descuentoPct) : undefined,
          precioFijo: precioFijo ? Number(precioFijo) : undefined,
          inicio: new Date(inicio).toISOString(),
          fin: new Date(fin).toISOString(),
        },
      });
      onCreada();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo crear la oferta.');
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center" onClick={onClose}>
      <form
        onSubmit={crear}
        className="w-full max-w-sm space-y-2 rounded-t-card bg-crema p-4 shadow-lg sm:rounded-card"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-bosque">Nueva oferta</p>
          <button type="button" aria-label="Cerrar" onClick={onClose} className="rounded-pill bg-white px-3 py-1 text-sm text-bosque shadow-sm">✕</button>
        </div>

        {producto ? (
          <div className="flex items-center justify-between rounded-card bg-white p-2 shadow-sm">
            <span className="text-sm text-bosque">{producto.nombre ?? producto.sku} <span className="text-xs text-bosque/40">({producto.sku})</span></span>
            <button type="button" onClick={() => setProducto(null)} className="text-xs font-medium text-acento">Cambiar</button>
          </div>
        ) : (
          <div>
            <input
              placeholder="Buscar producto…"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="w-full rounded-pill border border-musgo/30 bg-white px-3 py-2 text-sm"
            />
            {resultados.length > 0 && (
              <div className="mt-1 max-h-40 space-y-0.5 overflow-y-auto rounded-card border border-musgo/15 bg-white p-1">
                {resultados.map((p) => (
                  <button
                    type="button"
                    key={p.id}
                    onClick={() => {
                      setProducto(p);
                      setBusqueda('');
                    }}
                    className="block w-full rounded-card px-2 py-1.5 text-left text-xs hover:bg-crema"
                  >
                    {p.nombre ?? p.sku} <span className="text-bosque/40">({p.sku})</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <select value={alcance} onChange={(e) => setAlcance(e.target.value)} className="w-full rounded-pill border border-musgo/30 bg-white px-3 py-2 text-sm">
          {ALCANCES.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
        <div className="grid grid-cols-2 gap-2">
          <input type="number" step="0.01" placeholder="% descuento" value={descuentoPct} onChange={(e) => setDescuentoPct(e.target.value)} className="rounded-pill border border-musgo/30 bg-white px-3 py-2 text-sm" />
          <input type="number" step="0.01" placeholder="Precio fijo" value={precioFijo} onChange={(e) => setPrecioFijo(e.target.value)} className="rounded-pill border border-musgo/30 bg-white px-3 py-2 text-sm" />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <input required type="datetime-local" value={inicio} onChange={(e) => setInicio(e.target.value)} className="rounded-pill border border-musgo/30 bg-white px-3 py-2 text-sm" />
          <input required type="datetime-local" value={fin} onChange={(e) => setFin(e.target.value)} className="rounded-pill border border-musgo/30 bg-white px-3 py-2 text-sm" />
        </div>

        <ErrorBanner mensaje={error} />

        <button type="submit" disabled={guardando} className="w-full rounded-pill bg-acento py-2 text-sm font-medium text-white disabled:opacity-60">
          {guardando ? 'Creando…' : 'Crear oferta'}
        </button>
      </form>
    </div>
  );
}
