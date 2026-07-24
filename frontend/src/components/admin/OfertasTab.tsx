'use client';

import { useEffect, useState } from 'react';
import { apiFetch, ApiError } from '../../lib/api';

const ALCANCES = ['DIA', 'SEMANA', 'MES'];

type Catalogo = { id: string; canal: string; version: number; campaign: { nombre: string } };
type Oferta = {
  id: string;
  alcance: string;
  descuentoPct: string | null;
  precioFijo: string | null;
  inicio: string;
  fin: string;
  activa: boolean;
};

const FORM_INICIAL = { alcance: ALCANCES[0], descuentoPct: '', precioFijo: '', inicio: '', fin: '' };

export function OfertasTab() {
  const [catalogos, setCatalogos] = useState<Catalogo[]>([]);
  const [catalogoId, setCatalogoId] = useState('');
  const [ofertas, setOfertas] = useState<Oferta[]>([]);
  const [form, setForm] = useState(FORM_INICIAL);
  const [error, setError] = useState<string | null>(null);

  async function cargarCatalogos() {
    try {
      const data = await apiFetch<Catalogo[]>('/campaigns/catalogos?estado=PUBLICADO');
      setCatalogos(data);
      if (!catalogoId && data.length > 0) setCatalogoId(data[0].id);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo cargar los catálogos.');
    }
  }

  async function cargarOfertas(id: string) {
    if (!id) {
      setOfertas([]);
      return;
    }
    try {
      const data = await apiFetch<Oferta[]>(`/campaigns/ofertas?catalogId=${id}`);
      setOfertas(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo cargar las ofertas.');
    }
  }

  useEffect(() => {
    cargarCatalogos();
  }, []);

  useEffect(() => {
    cargarOfertas(catalogoId);
  }, [catalogoId]);

  function setCampo(campo: keyof typeof FORM_INICIAL, valor: string) {
    setForm((f) => ({ ...f, [campo]: valor }));
  }

  async function crearOferta(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await apiFetch('/campaigns/ofertas', {
        method: 'POST',
        body: {
          catalogId: catalogoId,
          alcance: form.alcance,
          descuentoPct: form.descuentoPct ? Number(form.descuentoPct) : undefined,
          precioFijo: form.precioFijo ? Number(form.precioFijo) : undefined,
          inicio: new Date(form.inicio).toISOString(),
          fin: new Date(form.fin).toISOString(),
        },
      });
      setForm(FORM_INICIAL);
      await cargarOfertas(catalogoId);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo crear la oferta.');
    }
  }

  if (catalogos.length === 0) {
    return <p className="rounded-card bg-white p-3 text-xs text-bosque/60 shadow-sm">No hay ningún catálogo publicado todavía.</p>;
  }

  return (
    <div className="space-y-3">
      <div className="rounded-card bg-white p-3 shadow-sm">
        <label className="text-xs font-medium uppercase text-bosque/60">Catálogo</label>
        <select value={catalogoId} onChange={(e) => setCatalogoId(e.target.value)} className="mt-1 w-full rounded-pill border border-musgo/30 px-3 py-2 text-sm">
          {catalogos.map((c) => (
            <option key={c.id} value={c.id}>{c.campaign.nombre} · {c.canal} · v{c.version}</option>
          ))}
        </select>
      </div>

      <form onSubmit={crearOferta} className="space-y-2 rounded-card bg-white p-3 shadow-sm">
        <p className="text-sm font-medium text-bosque">Nueva oferta (pop-up)</p>
        <select value={form.alcance} onChange={(e) => setCampo('alcance', e.target.value)} className="w-full rounded-pill border border-musgo/30 px-3 py-2 text-sm">
          {ALCANCES.map((a) => (
            <option key={a} value={a}>{a}</option>
          ))}
        </select>
        <div className="grid grid-cols-2 gap-2">
          <input type="number" step="0.01" placeholder="% descuento" value={form.descuentoPct} onChange={(e) => setCampo('descuentoPct', e.target.value)} className="rounded-pill border border-musgo/30 px-3 py-2 text-sm" />
          <input type="number" step="0.01" placeholder="Precio fijo" value={form.precioFijo} onChange={(e) => setCampo('precioFijo', e.target.value)} className="rounded-pill border border-musgo/30 px-3 py-2 text-sm" />
        </div>
        <p className="text-xs text-bosque/50">Completá % descuento o precio fijo (uno de los dos).</p>
        <div className="grid grid-cols-2 gap-2">
          <input required type="datetime-local" value={form.inicio} onChange={(e) => setCampo('inicio', e.target.value)} className="rounded-pill border border-musgo/30 px-3 py-2 text-sm" />
          <input required type="datetime-local" value={form.fin} onChange={(e) => setCampo('fin', e.target.value)} className="rounded-pill border border-musgo/30 px-3 py-2 text-sm" />
        </div>
        {error && <p className="text-xs text-red-600">{error}</p>}
        <button type="submit" className="w-full rounded-pill bg-acento py-2 text-sm font-medium text-white">Crear oferta</button>
      </form>

      <div className="space-y-2">
        {ofertas.map((o) => (
          <div key={o.id} className="rounded-card bg-white p-3 shadow-sm">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium">
                  {o.descuentoPct ? `${Number(o.descuentoPct)}% dcto.` : `S/ ${Number(o.precioFijo)} fijo`} · {o.alcance}
                </p>
                <p className="text-xs text-bosque/60">
                  {new Date(o.inicio).toLocaleString('es-PE')} → {new Date(o.fin).toLocaleString('es-PE')}
                </p>
              </div>
              <span className={`rounded-pill px-3 py-1 text-xs font-medium ${o.activa ? 'bg-bosque text-white' : 'bg-red-100 text-red-700'}`}>
                {o.activa ? 'Activa' : 'Inactiva'}
              </span>
            </div>
          </div>
        ))}
        {ofertas.length === 0 && <p className="text-xs text-bosque/50">Este catálogo todavía no tiene ofertas.</p>}
      </div>
    </div>
  );
}
