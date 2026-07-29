'use client';

import { useEffect, useState } from 'react';
import { apiFetch, ApiError, resolveAssetUrl } from '../../lib/api';
import { ErrorBanner } from '../ui/ErrorBanner';

export type LineaAdmin = {
  id: string;
  catalogId: string;
  sku: string;
  nombre: string | null;
  categoria: string | null;
  linea: string | null;
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
  componentesIds: string[];
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
  catalogId,
  productosDisponibles,
  onClose,
  onGuardado,
  onEliminado,
}: {
  // linea === null: alta de producto nuevo — mismo formulario completo que
  // editar, sin atajo con menos campos (ver auditoría UX). catalogId es
  // obligatorio en ese caso porque todavía no hay una línea de la que sacarlo.
  linea: LineaAdmin | null;
  catalogId?: string;
  // Para armar packs: productos ya cargados en el catálogo, para elegir
  // cuáles incluye este (ver auditoría UX / pedido de packs).
  productosDisponibles: LineaAdmin[];
  onClose: () => void;
  onGuardado: () => void;
  onEliminado: () => void;
}) {
  const esNuevo = linea === null;
  const [sku, setSku] = useState(linea?.sku ?? '');
  const [form, setForm] = useState({
    nombre: linea?.nombre ?? '',
    categoria: linea?.categoria ?? '',
    lineaProducto: linea?.linea ?? '',
    subcategoria: linea?.subcategoria ?? '',
    tipo: linea?.tipo ?? '',
    descripcion: linea?.descripcion ?? '',
    beneficios: linea?.beneficios ?? '',
    propiedades: linea?.propiedades ?? '',
    activos: linea?.activos ?? '',
    modoUso: linea?.modoUso ?? '',
    pvpCampania: linea?.pvpCampania ?? '',
  });
  const [componentesIds, setComponentesIds] = useState<string[]>(linea?.componentesIds ?? []);
  const [buscarComponente, setBuscarComponente] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [eliminando, setEliminando] = useState(false);
  const [oferta, setOferta] = useState<Oferta | null | undefined>(undefined);
  const [formOferta, setFormOferta] = useState({ alcance: ALCANCES[0], descuentoPct: '', precioFijo: '', inicio: '', fin: '' });

  function toggleComponente(id: string) {
    setComponentesIds((prev) => (prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]));
  }

  useEffect(() => {
    if (!linea) return;
    apiFetch<Oferta | null>(`/campaigns/ofertas/vigente?catalogLineId=${linea.id}`)
      .then(setOferta)
      .catch(() => setOferta(null));
  }, [esNuevo, linea?.id]);

  function setCampo(campo: keyof typeof form, valor: string) {
    setForm((f) => ({ ...f, [campo]: valor }));
  }

  async function guardar() {
    setError(null);
    if (esNuevo && !sku.trim()) {
      setError('El producto necesita un SKU.');
      return;
    }
    if (!form.pvpCampania) {
      setError('El producto necesita un precio.');
      return;
    }
    setGuardando(true);
    try {
      const { lineaProducto, ...resto } = form;
      if (!linea) {
        await apiFetch('/catalogo/admin/lineas', {
          method: 'POST',
          body: { ...resto, catalogId, sku: sku.trim(), linea: lineaProducto, pvpCampania: Number(form.pvpCampania), componentesIds },
        });
      } else {
        await apiFetch(`/catalogo/admin/lineas/${linea.id}`, {
          method: 'PATCH',
          body: { ...resto, linea: lineaProducto, pvpCampania: Number(form.pvpCampania), componentesIds },
        });
      }
      onGuardado();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo guardar.');
    } finally {
      setGuardando(false);
    }
  }

  async function eliminar() {
    if (!linea) return;
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
    if (!linea) return;
    const fd = new FormData();
    fd.append('foto', archivo);
    await apiFetch(`/catalogo/admin/lineas/${linea.id}/foto`, { method: 'POST', body: fd, isFormData: true });
    onGuardado();
  }

  async function subirFotosAdicionales(archivos: FileList) {
    if (!linea) return;
    const fd = new FormData();
    Array.from(archivos).forEach((f) => fd.append('fotos', f));
    await apiFetch(`/catalogo/admin/lineas/${linea.id}/fotos-adicionales`, { method: 'POST', body: fd, isFormData: true });
    onGuardado();
  }

  async function crearOferta(e: React.FormEvent) {
    e.preventDefault();
    if (!linea) return;
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
          <p className="text-sm font-medium text-bosque">{linea ? `Editar producto · ${linea.sku}` : 'Nuevo producto'}</p>
          <button aria-label="Cerrar" onClick={onClose} className="rounded-pill bg-white px-3 py-1 text-sm text-bosque shadow-sm">✕</button>
        </div>

        <div className="mt-3 space-y-3 rounded-card bg-white p-3 shadow-sm">
          {linea && (
            <>
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
            </>
          )}
          {esNuevo && (
            <>
              <Campo label="SKU" value={sku} onChange={setSku} />
              <p className="-mt-2 text-[11px] text-bosque/40">La foto se agrega después de crear el producto.</p>
            </>
          )}

          <Campo label="Nombre" value={form.nombre} onChange={(v) => setCampo('nombre', v)} />
          <div className="grid grid-cols-2 gap-2">
            <Campo label="Categoría" value={form.categoria} onChange={(v) => setCampo('categoria', v)} />
            <Campo label="Línea" value={form.lineaProducto} onChange={(v) => setCampo('lineaProducto', v)} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Campo label="Subcategoría" value={form.subcategoria} onChange={(v) => setCampo('subcategoria', v)} />
            <Campo label="Tipo" value={form.tipo} onChange={(v) => setCampo('tipo', v)} />
          </div>
          <Campo label="Precio (PVP campaña)" value={form.pvpCampania} onChange={(v) => setCampo('pvpCampania', v)} />
          <Campo label="Descripción" value={form.descripcion} onChange={(v) => setCampo('descripcion', v)} textarea />
          <Campo label="Beneficios (separar con |)" value={form.beneficios} onChange={(v) => setCampo('beneficios', v)} textarea />
          <Campo label="Propiedades (separar con |)" value={form.propiedades} onChange={(v) => setCampo('propiedades', v)} textarea />
          <Campo label="Activos (separar con |)" value={form.activos} onChange={(v) => setCampo('activos', v)} textarea />
          <Campo label="Modo de uso" value={form.modoUso} onChange={(v) => setCampo('modoUso', v)} textarea />

          <div>
            <label className="block text-xs font-medium uppercase text-bosque/60">Contenido del pack (opcional)</label>
            <p className="mt-0.5 text-[11px] text-bosque/40">
              Elegí productos ya cargados si este es un pack — es solo para mostrar qué incluye; el precio y la oferta del pack se manejan igual que en cualquier producto.
            </p>
            {componentesIds.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {componentesIds.map((id) => {
                  const p = productosDisponibles.find((x) => x.id === id);
                  return (
                    <span key={id} className="flex items-center gap-1 rounded-pill bg-musgo/15 px-2 py-1 text-[11px] text-bosque">
                      {p ? (p.nombre ?? p.sku) : id}
                      <button type="button" onClick={() => toggleComponente(id)} className="text-bosque/50 hover:text-acento">✕</button>
                    </span>
                  );
                })}
              </div>
            )}
            <input
              placeholder="Buscar producto para agregar…"
              value={buscarComponente}
              onChange={(e) => setBuscarComponente(e.target.value)}
              className="mt-2 w-full rounded-pill border border-musgo/30 px-3 py-2 text-sm"
            />
            {buscarComponente.trim() && (
              <div className="mt-1 max-h-40 space-y-0.5 overflow-y-auto rounded-card border border-musgo/15 bg-white p-1">
                {productosDisponibles
                  .filter((p) => p.id !== linea?.id && !componentesIds.includes(p.id))
                  .filter((p) => `${p.nombre ?? ''} ${p.sku}`.toLowerCase().includes(buscarComponente.trim().toLowerCase()))
                  .slice(0, 8)
                  .map((p) => (
                    <button
                      type="button"
                      key={p.id}
                      onClick={() => {
                        toggleComponente(p.id);
                        setBuscarComponente('');
                      }}
                      className="block w-full rounded-card px-2 py-1.5 text-left text-xs hover:bg-crema"
                    >
                      {p.nombre ?? p.sku} <span className="text-bosque/40">({p.sku})</span>
                    </button>
                  ))}
              </div>
            )}
          </div>

          <ErrorBanner mensaje={error} />

          <div className="flex gap-2">
            <button onClick={guardar} disabled={guardando} className="flex-1 rounded-pill bg-bosque py-2 text-sm font-medium text-white disabled:opacity-60">
              {guardando ? 'Guardando…' : esNuevo ? 'Crear producto' : 'Guardar cambios'}
            </button>
            {linea && (
              <button onClick={eliminar} disabled={eliminando} className="rounded-pill bg-red-100 px-4 py-2 text-sm font-medium text-red-700 disabled:opacity-60">
                {eliminando ? 'Eliminando…' : 'Eliminar'}
              </button>
            )}
          </div>
        </div>

        {linea && (
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
        )}
      </div>
    </div>
  );
}
