'use client';

import { useEffect, useState } from 'react';
import { apiFetch, ApiError, resolveAssetUrl } from '../../lib/api';

export type LineaAdmin = {
  id: string;
  catalogId: string;
  sku: string;
  nombre: string | null;
  categoria: string | null;
  subcategoria: string | null;
  tipo: string | null;
  descripcion: string | null;
  beneficios: string | null;
  propiedades: string | null;
  activos: string | null;
  modoUso: string | null;
  pvpCampania: string;
  imagenUrl: string | null;
  imagenesAdicionales: string[];
};

type Oferta = { id: string; alcance: string; descuentoPct: string | null; precioFijo: string | null; inicio: string; fin: string; activa: boolean };

const ALCANCES = ['DIA', 'SEMANA', 'MES'];

function Campo({ label, value, onChange, textarea }: { label: string; value: string; onChange: (v: string) => void; textarea?: boolean }) {
  return (
    <div>
      <label className="block text-xs font-medium uppercase text-bosque/60">{label}</label>
      {textarea ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={2}
          className="mt-1 w-full rounded-card border border-musgo/30 px-3 py-2 text-sm"
        />
      ) : (
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="mt-1 w-full rounded-pill border border-musgo/30 px-3 py-2 text-sm"
        />
      )}
    </div>
  );
}

export function EditarProductoModal({
  linea,
  onClose,
  onGuardado,
  onEliminado,
}: {
  linea: LineaAdmin;
  onClose: () => void;
  onGuardado: () => void;
  onEliminado: () => void;
}) {
  const [form, setForm] = useState({
    nombre: linea.nombre ?? '',
    categoria: linea.categoria ?? '',
    subcategoria: linea.subcategoria ?? '',
    tipo: linea.tipo ?? '',
    descripcion: linea.descripcion ?? '',
    beneficios: linea.beneficios ?? '',
    propiedades: linea.propiedades ?? '',
    activos: linea.activos ?? '',
    modoUso: linea.modoUso ?? '',
    pvpCampania: linea.pvpCampania,
  });
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [eliminando, setEliminando] = useState(false);
  const [oferta, setOferta] = useState<Oferta | null | undefined>(undefined);
  const [formOferta, setFormOferta] = useState({ alcance: ALCANCES[0], descuentoPct: '', precioFijo: '', inicio: '', fin: '' });

  useEffect(() => {
    apiFetch<Oferta | null>(`/campaigns/ofertas/vigente?catalogLineId=${linea.id}`)
      .then(setOferta)
      .catch(() => setOferta(null));
  }, [linea.id]);

  function setCampo(campo: keyof typeof form, valor: string) {
    setForm((f) => ({ ...f, [campo]: valor }));
  }

  async function guardar() {
    setError(null);
    setGuardando(true);
    try {
      await apiFetch(`/catalogo/admin/lineas/${linea.id}`, {
        method: 'PATCH',
        body: { ...form, pvpCampania: Number(form.pvpCampania) },
      });
      onGuardado();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo guardar.');
    } finally {
      setGuardando(false);
    }
  }

  async function eliminar() {
    if (!confirm(`¿Eliminar "${form.nombre || linea.sku}" del catálogo? Esta acción no se puede deshacer.`)) return;
    setError(null);
    setEliminando(true);
    try {
      await apiFetch(`/catalogo/admin/lineas/${linea.id}`, { method: 'DELETE' });
      onEliminado();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo eliminar.');
      setEliminando(false);
    }
  }

  async function subirFoto(archivo: File) {
    const fd = new FormData();
    fd.append('foto', archivo);
    await apiFetch(`/catalogo/admin/lineas/${linea.id}/foto`, { method: 'POST', body: fd, isFormData: true });
    onGuardado();
  }

  async function subirFotosAdicionales(archivos: FileList) {
    const fd = new FormData();
    Array.from(archivos).forEach((f) => fd.append('fotos', f));
    await apiFetch(`/catalogo/admin/lineas/${linea.id}/fotos-adicionales`, { method: 'POST', body: fd, isFormData: true });
    onGuardado();
  }

  async function crearOferta(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await apiFetch('/campaigns/ofertas', {
        method: 'POST',
        body: {
          catalogId: linea.catalogId,
          catalogLineId: linea.id,
          alcance: formOferta.alcance,
          descuentoPct: formOferta.descuentoPct ? Number(formOferta.descuentoPct) : undefined,
          precioFijo: formOferta.precioFijo ? Number(formOferta.precioFijo) : undefined,
          inicio: new Date(formOferta.inicio).toISOString(),
          fin: new Date(formOferta.fin).toISOString(),
        },
      });
      const nueva = await apiFetch<Oferta | null>(`/campaigns/ofertas/vigente?catalogLineId=${linea.id}`);
      setOferta(nueva);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo crear la oferta.');
    }
  }

  async function desactivarOferta() {
    if (!oferta) return;
    await apiFetch(`/campaigns/ofertas/${oferta.id}/desactivar`, { method: 'POST' });
    setOferta(null);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center" onClick={onClose}>
      <div
        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-t-card bg-crema p-4 shadow-lg sm:rounded-card"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-bosque">Editar producto · {linea.sku}</p>
          <button aria-label="Cerrar" onClick={onClose} className="rounded-pill bg-white px-3 py-1 text-sm text-bosque shadow-sm">✕</button>
        </div>

        <div className="mt-3 space-y-3 rounded-card bg-white p-3 shadow-sm">
          <div className="flex gap-2 overflow-x-auto">
            {[linea.imagenUrl, ...linea.imagenesAdicionales].filter(Boolean).map((img) => (
              <img key={img} src={resolveAssetUrl(img as string)} alt="" className="h-20 w-20 shrink-0 rounded-card object-cover" />
            ))}
            {!linea.imagenUrl && <div className="flex h-20 w-20 items-center justify-center rounded-card border border-dashed border-musgo/30 text-[10px] text-bosque/50">sin foto</div>}
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <label className="rounded-pill bg-crema px-3 py-2 text-center text-bosque">
              Cambiar foto principal
              <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && subirFoto(e.target.files[0])} />
            </label>
            <label className="rounded-pill bg-crema px-3 py-2 text-center text-bosque">
              Agregar fotos adicionales
              <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => e.target.files && subirFotosAdicionales(e.target.files)} />
            </label>
          </div>

          <Campo label="Nombre" value={form.nombre} onChange={(v) => setCampo('nombre', v)} />
          <div className="grid grid-cols-3 gap-2">
            <Campo label="Categoría" value={form.categoria} onChange={(v) => setCampo('categoria', v)} />
            <Campo label="Subcategoría" value={form.subcategoria} onChange={(v) => setCampo('subcategoria', v)} />
            <Campo label="Tipo" value={form.tipo} onChange={(v) => setCampo('tipo', v)} />
          </div>
          <Campo label="Precio (PVP campaña)" value={form.pvpCampania} onChange={(v) => setCampo('pvpCampania', v)} />
          <Campo label="Descripción" value={form.descripcion} onChange={(v) => setCampo('descripcion', v)} textarea />
          <Campo label="Beneficios (separar con |)" value={form.beneficios} onChange={(v) => setCampo('beneficios', v)} textarea />
          <Campo label="Propiedades (separar con |)" value={form.propiedades} onChange={(v) => setCampo('propiedades', v)} textarea />
          <Campo label="Activos (separar con |)" value={form.activos} onChange={(v) => setCampo('activos', v)} textarea />
          <Campo label="Modo de uso" value={form.modoUso} onChange={(v) => setCampo('modoUso', v)} textarea />

          {error && <p className="text-xs text-red-600">{error}</p>}

          <div className="flex gap-2">
            <button onClick={guardar} disabled={guardando} className="flex-1 rounded-pill bg-bosque py-2 text-sm font-medium text-white disabled:opacity-60">
              {guardando ? 'Guardando…' : 'Guardar cambios'}
            </button>
            <button onClick={eliminar} disabled={eliminando} className="rounded-pill bg-red-100 px-4 py-2 text-sm font-medium text-red-700 disabled:opacity-60">
              {eliminando ? 'Eliminando…' : 'Eliminar'}
            </button>
          </div>
        </div>

        <div className="mt-3 space-y-2 rounded-card bg-white p-3 shadow-sm">
          <p className="text-sm font-medium text-bosque">Oferta</p>
          {oferta === undefined && <p className="text-xs text-bosque/50">Consultando…</p>}
          {oferta === null && <p className="text-xs text-bosque/50">Este producto no tiene una oferta activa.</p>}
          {oferta && (
            <div className="flex items-center justify-between rounded-card bg-crema p-2">
              <p className="text-xs text-bosque">
                {oferta.descuentoPct ? `-${Number(oferta.descuentoPct)}%` : `S/ ${Number(oferta.precioFijo)} fijo`} · {oferta.alcance} · vence {new Date(oferta.fin).toLocaleDateString('es-PE')}
              </p>
              <button onClick={desactivarOferta} className="rounded-pill bg-white px-3 py-1 text-xs font-medium text-acento shadow-sm">Desactivar</button>
            </div>
          )}
          {!oferta && (
            <form onSubmit={crearOferta} className="space-y-2">
              <select value={formOferta.alcance} onChange={(e) => setFormOferta((f) => ({ ...f, alcance: e.target.value }))} className="w-full rounded-pill border border-musgo/30 px-3 py-2 text-sm">
                {ALCANCES.map((a) => <option key={a} value={a}>{a}</option>)}
              </select>
              <div className="grid grid-cols-2 gap-2">
                <input type="number" step="0.01" placeholder="% descuento" value={formOferta.descuentoPct} onChange={(e) => setFormOferta((f) => ({ ...f, descuentoPct: e.target.value }))} className="rounded-pill border border-musgo/30 px-3 py-2 text-sm" />
                <input type="number" step="0.01" placeholder="Precio fijo" value={formOferta.precioFijo} onChange={(e) => setFormOferta((f) => ({ ...f, precioFijo: e.target.value }))} className="rounded-pill border border-musgo/30 px-3 py-2 text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input required type="datetime-local" value={formOferta.inicio} onChange={(e) => setFormOferta((f) => ({ ...f, inicio: e.target.value }))} className="rounded-pill border border-musgo/30 px-3 py-2 text-sm" />
                <input required type="datetime-local" value={formOferta.fin} onChange={(e) => setFormOferta((f) => ({ ...f, fin: e.target.value }))} className="rounded-pill border border-musgo/30 px-3 py-2 text-sm" />
              </div>
              <button type="submit" className="w-full rounded-pill bg-acento py-2 text-sm font-medium text-white">Crear oferta para este producto</button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
