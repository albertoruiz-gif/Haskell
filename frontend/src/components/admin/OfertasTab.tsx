'use client';

// Ofertas ya no se crean acá — cada oferta es propia de un producto y se
// crea/desactiva desde "Ver ficha completa" en Catálogo/Precios (evita el
// duplicado de tener dos formularios distintos para lo mismo, ver
// auditoría UX). Esta pantalla es la hoja de registro: todas las ofertas
// juntas, activas e inactivas, con "Relanzar" para volver a activar una
// vencida con nuevas fechas/descuento — relanzar crea una oferta NUEVA
// (la vieja queda de historial), no pisa el registro anterior.

import { useState, useEffect } from 'react';
import { apiFetch, ApiError } from '../../lib/api';
import { ErrorBanner } from '../ui/ErrorBanner';

const ALCANCES = ['DIA', 'SEMANA', 'MES'];

type Oferta = {
  id: string;
  catalogId: string;
  catalogLineId: string | null;
  alcance: string;
  descuentoPct: string | null;
  precioFijo: string | null;
  inicio: string;
  fin: string;
  activa: boolean;
  catalogLine: { sku: string; nombre: string | null } | null;
};

type Props = { onIrACatalogoPrecios: () => void };

export function OfertasTab({ onIrACatalogoPrecios }: Props) {
  const [ofertas, setOfertas] = useState<Oferta[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);
  const [relanzando, setRelanzando] = useState<Oferta | null>(null);

  async function cargar() {
    setCargando(true);
    try {
      const data = await apiFetch<Oferta[]>('/campaigns/ofertas');
      setOfertas(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo cargar las ofertas.');
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    cargar();
  }, []);

  async function desactivar(id: string) {
    setError(null);
    try {
      await apiFetch(`/campaigns/ofertas/${id}/desactivar`, { method: 'POST' });
      await cargar();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo desactivar la oferta.');
    }
  }

  async function relanzar(datos: { alcance: string; descuentoPct: string; precioFijo: string; inicio: string; fin: string }) {
    if (!relanzando) return;
    setError(null);
    try {
      await apiFetch('/campaigns/ofertas', {
        method: 'POST',
        body: {
          catalogId: relanzando.catalogId,
          catalogLineId: relanzando.catalogLineId ?? undefined,
          alcance: datos.alcance,
          descuentoPct: datos.descuentoPct ? Number(datos.descuentoPct) : undefined,
          precioFijo: datos.precioFijo ? Number(datos.precioFijo) : undefined,
          inicio: new Date(datos.inicio).toISOString(),
          fin: new Date(datos.fin).toISOString(),
        },
      });
      setRelanzando(null);
      await cargar();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo relanzar la oferta.');
    }
  }

  const ESTADO_COLOR: Record<string, string> = {
    Activa: 'bg-bosque text-white',
    Vencida: 'bg-red-100 text-red-700',
  };

  return (
    <div className="space-y-3">
      <div className="rounded-card bg-musgo/10 p-3 text-xs text-bosque/70">
        Las ofertas se crean por producto: entrá a un producto en <strong>Catálogo/Precios</strong> → "Ver ficha
        completa" → Oferta. Acá se ven todas juntas y se pueden relanzar.
      </div>

      <ErrorBanner mensaje={error} />
      {cargando && <p className="text-xs text-bosque/50">Cargando…</p>}

      {!cargando && ofertas.length === 0 && (
        <div className="rounded-card bg-white p-3 text-xs text-bosque/60 shadow-sm">
          <p>Todavía no hay ninguna oferta creada.</p>
          <button onClick={onIrACatalogoPrecios} className="mt-2 rounded-pill bg-bosque px-3 py-1.5 text-xs font-medium text-white">
            Ir a Catálogo/Precios →
          </button>
        </div>
      )}

      {!cargando && ofertas.length > 0 && (
        <div className="overflow-x-auto rounded-card bg-white shadow-sm">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-musgo/15 text-left text-[11px] font-medium uppercase text-bosque/50">
                <th className="px-3 py-2">Producto</th>
                <th className="px-3 py-2">Descuento</th>
                <th className="px-3 py-2">Alcance</th>
                <th className="px-3 py-2">Vigencia</th>
                <th className="px-3 py-2">Estado</th>
                <th className="px-3 py-2">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {ofertas.map((o) => {
                const estado = o.activa ? 'Activa' : 'Vencida';
                return (
                  <tr key={o.id} className="border-b border-musgo/10 last:border-0">
                    <td className="px-3 py-2 font-medium text-bosque">
                      {o.catalogLine ? (o.catalogLine.nombre ?? o.catalogLine.sku) : 'Todo el catálogo'}
                    </td>
                    <td className="px-3 py-2 text-bosque/70">
                      {o.descuentoPct ? `${Number(o.descuentoPct)}% dcto.` : `S/ ${Number(o.precioFijo).toFixed(2)} fijo`}
                    </td>
                    <td className="px-3 py-2 text-bosque/70">{o.alcance}</td>
                    <td className="px-3 py-2 text-xs text-bosque/60">
                      {new Date(o.inicio).toLocaleDateString('es-PE')} → {new Date(o.fin).toLocaleDateString('es-PE')}
                    </td>
                    <td className="px-3 py-2">
                      <span className={`rounded-pill px-2 py-0.5 text-[11px] font-medium ${ESTADO_COLOR[estado]}`}>{estado}</span>
                    </td>
                    <td className="px-3 py-2">
                      {o.activa ? (
                        <button onClick={() => desactivar(o.id)} className="rounded-pill bg-crema px-3 py-1 text-xs font-medium text-acento">
                          Desactivar
                        </button>
                      ) : (
                        <button onClick={() => setRelanzando(o)} className="rounded-pill bg-acento px-3 py-1 text-xs font-medium text-white">
                          Relanzar
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {relanzando && <RelanzarOfertaModal oferta={relanzando} onClose={() => setRelanzando(null)} onConfirmar={relanzar} />}
    </div>
  );
}

function RelanzarOfertaModal({
  oferta,
  onClose,
  onConfirmar,
}: {
  oferta: Oferta;
  onClose: () => void;
  onConfirmar: (datos: { alcance: string; descuentoPct: string; precioFijo: string; inicio: string; fin: string }) => void;
}) {
  const [alcance, setAlcance] = useState(oferta.alcance);
  const [descuentoPct, setDescuentoPct] = useState(oferta.descuentoPct ?? '');
  const [precioFijo, setPrecioFijo] = useState(oferta.precioFijo ?? '');
  const [inicio, setInicio] = useState('');
  const [fin, setFin] = useState('');

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    onConfirmar({ alcance, descuentoPct, precioFijo, inicio, fin });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center" onClick={onClose}>
      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm space-y-2 rounded-t-card bg-crema p-4 shadow-lg sm:rounded-card"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-bosque">
            Relanzar · {oferta.catalogLine ? (oferta.catalogLine.nombre ?? oferta.catalogLine.sku) : 'Todo el catálogo'}
          </p>
          <button type="button" aria-label="Cerrar" onClick={onClose} className="rounded-pill bg-white px-3 py-1 text-sm text-bosque shadow-sm">✕</button>
        </div>
        <p className="text-xs text-bosque/50">Ajustá lo que haga falta y elegí nuevas fechas — se crea como una oferta nueva; esta queda de historial.</p>

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
        <button type="submit" className="w-full rounded-pill bg-acento py-2 text-sm font-medium text-white">Relanzar oferta</button>
      </form>
    </div>
  );
}
