'use client';

import { useState } from 'react';
import { apiFetch, ApiError, resolveAssetUrl } from '../../lib/api';
import { ErrorBanner } from '../ui/ErrorBanner';

export type PackComponenteAdmin = {
  id: string;
  descuentoPct: string;
  componente: { id: string; sku: string; nombre: string | null; pvpCampania: string };
};

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
  packComponentes: PackComponenteAdmin[];
};

function Campo({ label, value, onChange, textarea, disabled }: { label: string; value: string; onChange: (v: string) => void; textarea?: boolean; disabled?: boolean }) {
  return (
    <div>
      <label className="block text-xs font-medium uppercase text-bosque/60">{label}</label>
      {textarea ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={2}
          disabled={disabled}
          className="mt-1 w-full rounded-card border border-musgo/30 px-3 py-2 text-sm disabled:bg-crema disabled:text-bosque/50"
        />
      ) : (
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className="mt-1 w-full rounded-pill border border-musgo/30 px-3 py-2 text-sm disabled:bg-crema disabled:text-bosque/50"
        />
      )}
    </div>
  );
}

export function EditarProductoModal({
  linea,
  catalogId,
  onClose,
  onGuardado,
  onEliminado,
}: {
  // linea === null: alta de producto nuevo — mismo formulario completo que
  // editar, sin atajo con menos campos (ver auditoría UX). catalogId es
  // obligatorio en ese caso porque todavía no hay una línea de la que sacarlo.
  linea: LineaAdmin | null;
  catalogId?: string;
  onClose: () => void;
  onGuardado: () => void;
  onEliminado: () => void;
}) {
  const esNuevo = linea === null;
  const esPack = !esNuevo && linea.packComponentes.length > 0;
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
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [eliminando, setEliminando] = useState(false);

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
      const { lineaProducto, pvpCampania, ...resto } = form;
      if (!linea) {
        await apiFetch('/catalogo/admin/lineas', {
          method: 'POST',
          body: { ...resto, catalogId, sku: sku.trim(), linea: lineaProducto, pvpCampania: Number(pvpCampania) },
        });
      } else {
        // El precio de un pack se recalcula solo desde sus componentes
        // (Gestión → Ofertas y Packs) — mandarlo acá lo pisaría al toque.
        await apiFetch(`/catalogo/admin/lineas/${linea.id}`, {
          method: 'PATCH',
          body: esPack ? { ...resto, linea: lineaProducto } : { ...resto, linea: lineaProducto, pvpCampania: Number(pvpCampania) },
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
          <Campo label="Precio (PVP campaña)" value={form.pvpCampania} onChange={(v) => setCampo('pvpCampania', v)} disabled={esPack} />
          {esPack && (
            <p className="-mt-2 text-[11px] text-bosque/40">
              Este producto es un pack — su precio se calcula solo sumando sus componentes. Editalo desde Gestión → Ofertas y Packs.
            </p>
          )}
          <Campo label="Descripción" value={form.descripcion} onChange={(v) => setCampo('descripcion', v)} textarea />
          <Campo label="Beneficios (separar con |)" value={form.beneficios} onChange={(v) => setCampo('beneficios', v)} textarea />
          <Campo label="Propiedades (separar con |)" value={form.propiedades} onChange={(v) => setCampo('propiedades', v)} textarea />
          <Campo label="Activos (separar con |)" value={form.activos} onChange={(v) => setCampo('activos', v)} textarea />
          <Campo label="Modo de uso" value={form.modoUso} onChange={(v) => setCampo('modoUso', v)} textarea />

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
      </div>
    </div>
  );
}
