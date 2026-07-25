'use client';

// Gestion de campañas y catálogos: crear, agregar catálogo por canal, y
// publicarlo. Sin esto no había forma de hacerlo desde la interfaz — solo
// por API directa — así que los catálogos nuevos nunca aparecían en
// Catálogo/Precios ni en el catálogo real del asesor.

import { useEffect, useState } from 'react';
import { apiFetch, ApiError } from '../../lib/api';

const CANALES = ['SALONES_BELLEZA', 'RETAIL', 'COMERCIO_MINORISTA'];

type Campania = { id: string; codigo: string; nombre: string; canalesObjetivo: string[] };
type CatalogoConCampania = { id: string; canal: string; version: number; estado: string; campaign: { nombre: string } };

const FORM_CAMPANIA_INICIAL = { codigo: '', nombre: '', fechaInicio: '', fechaFin: '', canalesObjetivo: [] as string[] };

export function CatalogosPanel({ onCambio }: { onCambio: () => void }) {
  const [campanias, setCampanias] = useState<Campania[]>([]);
  const [catalogos, setCatalogos] = useState<CatalogoConCampania[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [formCampania, setFormCampania] = useState(FORM_CAMPANIA_INICIAL);
  const [canalNuevo, setCanalNuevo] = useState<Record<string, string>>({});
  const [vigencia, setVigencia] = useState<Record<string, { desde: string; hasta: string }>>({});
  const [abierto, setAbierto] = useState(false);

  async function cargar() {
    try {
      const [c, cat] = await Promise.all([
        apiFetch<Campania[]>('/campaigns'),
        apiFetch<CatalogoConCampania[]>('/campaigns/catalogos'),
      ]);
      setCampanias(c);
      setCatalogos(cat);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo cargar campañas/catálogos.');
    }
  }

  useEffect(() => {
    cargar();
  }, []);

  function toggleCanal(canal: string) {
    setFormCampania((f) => ({
      ...f,
      canalesObjetivo: f.canalesObjetivo.includes(canal) ? f.canalesObjetivo.filter((c) => c !== canal) : [...f.canalesObjetivo, canal],
    }));
  }

  async function crearCampania(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await apiFetch('/campaigns', { method: 'POST', body: formCampania });
      setFormCampania(FORM_CAMPANIA_INICIAL);
      await cargar();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo crear la campaña.');
    }
  }

  async function crearCatalogo(campaignId: string) {
    setError(null);
    const canal = canalNuevo[campaignId];
    if (!canal) return;
    try {
      await apiFetch(`/campaigns/${campaignId}/catalogos`, { method: 'POST', body: { canal } });
      await cargar();
      onCambio();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo crear el catálogo.');
    }
  }

  async function publicar(catalogId: string) {
    setError(null);
    const v = vigencia[catalogId] ?? {
      desde: new Date().toISOString().slice(0, 10),
      hasta: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
    };
    try {
      await apiFetch(`/campaigns/catalogos/${catalogId}/publicar`, {
        method: 'POST',
        body: { vigenciaDesde: v.desde, vigenciaHasta: v.hasta },
      });
      await cargar();
      onCambio();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo publicar el catálogo.');
    }
  }

  const ESTADO_COLOR: Record<string, string> = {
    PUBLICADO: 'bg-bosque text-white',
    BORRADOR: 'bg-crema text-bosque/70',
    APROBADO: 'bg-musgo/20 text-musgo-dark',
    SUSPENDIDO: 'bg-red-100 text-red-700',
  };

  return (
    <div className="rounded-card bg-white p-3 shadow-sm">
      <button onClick={() => setAbierto((a) => !a)} className="flex w-full items-center justify-between text-left">
        <p className="text-sm font-medium text-bosque">Campañas y catálogos</p>
        <span className="text-xs text-bosque/50">{abierto ? 'Ocultar ▲' : 'Mostrar ▼'}</span>
      </button>

      {abierto && (
        <div className="mt-3 space-y-3">
          {error && <p className="text-xs text-red-600">{error}</p>}

          {campanias.map((camp) => {
            const catalogosDeCampania = catalogos.filter((c) => c.campaign.nombre === camp.nombre);
            return (
              <div key={camp.id} className="rounded-card border border-musgo/20 p-2">
                <p className="text-sm font-medium text-bosque">{camp.nombre} <span className="text-xs text-bosque/50">({camp.codigo})</span></p>

                <div className="mt-1 space-y-1">
                  {catalogosDeCampania.map((cat) => (
                    <div key={cat.id} className="flex items-center justify-between rounded-card bg-crema px-2 py-1">
                      <span className="text-xs text-bosque">{cat.canal} · v{cat.version}</span>
                      <div className="flex items-center gap-2">
                        <span className={`rounded-pill px-2 py-0.5 text-[11px] font-medium ${ESTADO_COLOR[cat.estado] ?? ''}`}>{cat.estado}</span>
                        {cat.estado !== 'PUBLICADO' && (
                          <button onClick={() => publicar(cat.id)} className="rounded-pill bg-acento px-2 py-1 text-[11px] font-medium text-white">
                            Publicar
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                  {catalogosDeCampania.length === 0 && <p className="px-2 text-xs text-bosque/40">Sin catálogos todavía.</p>}
                </div>

                <div className="mt-2 flex gap-2">
                  <select
                    value={canalNuevo[camp.id] ?? ''}
                    onChange={(e) => setCanalNuevo((s) => ({ ...s, [camp.id]: e.target.value }))}
                    className="flex-1 rounded-pill border border-musgo/30 px-2 py-1 text-xs"
                  >
                    <option value="">Elegir canal…</option>
                    {CANALES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <button onClick={() => crearCatalogo(camp.id)} className="rounded-pill bg-bosque px-3 py-1 text-xs font-medium text-white">
                    + Catálogo
                  </button>
                </div>
              </div>
            );
          })}

          <form onSubmit={crearCampania} className="space-y-2 rounded-card border border-dashed border-musgo/30 p-2">
            <p className="text-xs font-medium text-bosque">Nueva campaña</p>
            <input required placeholder="Código (ej. CAMP-02)" value={formCampania.codigo} onChange={(e) => setFormCampania((f) => ({ ...f, codigo: e.target.value }))} className="w-full rounded-pill border border-musgo/30 px-3 py-1.5 text-xs" />
            <input required placeholder="Nombre" value={formCampania.nombre} onChange={(e) => setFormCampania((f) => ({ ...f, nombre: e.target.value }))} className="w-full rounded-pill border border-musgo/30 px-3 py-1.5 text-xs" />
            <div className="grid grid-cols-2 gap-2">
              <input required type="date" value={formCampania.fechaInicio} onChange={(e) => setFormCampania((f) => ({ ...f, fechaInicio: e.target.value }))} className="rounded-pill border border-musgo/30 px-3 py-1.5 text-xs" />
              <input required type="date" value={formCampania.fechaFin} onChange={(e) => setFormCampania((f) => ({ ...f, fechaFin: e.target.value }))} className="rounded-pill border border-musgo/30 px-3 py-1.5 text-xs" />
            </div>
            <div className="flex gap-2 text-xs">
              {CANALES.map((c) => (
                <label key={c} className="flex items-center gap-1">
                  <input type="checkbox" checked={formCampania.canalesObjetivo.includes(c)} onChange={() => toggleCanal(c)} />
                  {c}
                </label>
              ))}
            </div>
            <button type="submit" className="w-full rounded-pill bg-bosque py-1.5 text-xs font-medium text-white">Crear campaña</button>
          </form>
        </div>
      )}
    </div>
  );
}
