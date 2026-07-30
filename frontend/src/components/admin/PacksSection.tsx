'use client';

// Packs: un producto normal (su propio SKU/nombre/foto) al que se le
// asignan componentes de UNA sola vez, con un % de descuento propio por
// componente (no la oferta normal del producto). El precio del pack se
// calcula solo, sumando cada componente ya con su descuento — no es
// editable a mano (ver EditarProductoModal).

import { useState } from 'react';
import { apiFetch, ApiError, resolveAssetUrl } from '../../lib/api';
import { FiltrosCatalogo } from '../catalogo/FiltrosCatalogo';
import { useFiltrosCatalogo } from '../../lib/useFiltrosCatalogo';
import { ErrorBanner } from '../ui/ErrorBanner';
import { LineaAdmin } from './EditarProductoModal';

type Props = {
  catalogoId: string;
  lineas: LineaAdmin[];
  onCambio: () => void;
};

export function PacksSection({ catalogoId, lineas, onCambio }: Props) {
  const [creando, setCreando] = useState(false);
  const [editando, setEditando] = useState<LineaAdmin | null>(null);

  const packs = lineas.filter((l) => l.packComponentes.length > 0);

  return (
    <div className="space-y-3">
      <div className="rounded-card bg-white p-3 shadow-sm lg:max-w-sm">
        <p className="text-sm font-medium text-bosque">Nuevo pack</p>
        <p className="mt-1 text-xs text-bosque/50">
          Elegís todos los componentes de una sola vez, con su % de descuento propio — el precio del pack se calcula solo.
        </p>
        <button
          onClick={() => setCreando(true)}
          disabled={!catalogoId}
          className="mt-2 w-full rounded-pill bg-bosque py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          + Nuevo pack
        </button>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {packs.map((p) => (
          <div key={p.id} className="rounded-card bg-white p-3 shadow-sm">
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium">{p.nombre ?? p.sku}</p>
              <span className="rounded-pill bg-acento/15 px-2 py-0.5 text-[11px] font-medium text-acento">Pack</span>
            </div>
            <p className="text-xs text-bosque/50">{p.sku}</p>

            {p.imagenUrl ? (
              <img src={resolveAssetUrl(p.imagenUrl)} alt={p.sku} className="my-3 h-32 w-full rounded-card object-cover" />
            ) : (
              <div className="my-3 flex h-32 items-center justify-center rounded-card border border-dashed border-musgo/30 text-xs text-bosque/50">
                foto producto
              </div>
            )}

            <p className="text-lg font-medium text-acento">S/ {Number(p.pvpCampania).toFixed(2)}</p>

            <ul className="mt-2 space-y-1">
              {p.packComponentes.map((pc) => (
                <li key={pc.id} className="flex items-center justify-between text-xs text-bosque/70">
                  <span>{pc.componente.nombre ?? pc.componente.sku}</span>
                  <span className="text-bosque/50">
                    S/ {Number(pc.componente.pvpCampania).toFixed(2)} {Number(pc.descuentoPct) > 0 && `· -${Number(pc.descuentoPct)}%`}
                  </span>
                </li>
              ))}
            </ul>

            <button
              onClick={() => setEditando(p)}
              className="mt-2 w-full rounded-pill bg-crema py-2 text-xs font-medium text-bosque"
            >
              Editar componentes ›
            </button>
          </div>
        ))}
        {packs.length === 0 && catalogoId && (
          <p className="text-xs text-bosque/50">Todavía no hay ningún pack armado en este catálogo.</p>
        )}
      </div>

      {creando && (
        <PackBuilderModal
          catalogoId={catalogoId}
          pack={null}
          lineasDisponibles={lineas}
          onClose={() => setCreando(false)}
          onGuardado={() => {
            setCreando(false);
            onCambio();
          }}
        />
      )}

      {editando && (
        <PackBuilderModal
          catalogoId={catalogoId}
          pack={editando}
          lineasDisponibles={lineas}
          onClose={() => setEditando(null)}
          onGuardado={() => {
            setEditando(null);
            onCambio();
          }}
        />
      )}
    </div>
  );
}

function PackBuilderModal({
  catalogoId,
  pack,
  lineasDisponibles,
  onClose,
  onGuardado,
}: {
  catalogoId: string;
  pack: LineaAdmin | null;
  lineasDisponibles: LineaAdmin[];
  onClose: () => void;
  onGuardado: () => void;
}) {
  const esNuevo = pack === null;
  const [sku, setSku] = useState('');
  const [nombre, setNombre] = useState('');
  const [seleccion, setSeleccion] = useState<Record<string, string>>(
    () => Object.fromEntries((pack?.packComponentes ?? []).map((pc) => [pc.componente.id, pc.descuentoPct])),
  );
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  // No se puede armar un pack con otro pack adentro (evita precios en
  // cascada difíciles de seguir), ni con el propio pack que se está editando.
  const candidatos = lineasDisponibles.filter((l) => l.packComponentes.length === 0 && l.id !== pack?.id);
  const { busqueda, setBusqueda, categoria, setCategoria, categorias, subcategoria, setSubcategoria, subcategorias, tipo, setTipo, tipos, filtrados } =
    useFiltrosCatalogo(candidatos);

  function toggle(id: string) {
    setSeleccion((prev) => {
      const copia = { ...prev };
      if (id in copia) delete copia[id];
      else copia[id] = '0';
      return copia;
    });
  }

  function setDescuento(id: string, valor: string) {
    setSeleccion((prev) => ({ ...prev, [id]: valor }));
  }

  const seleccionados = candidatos.filter((l) => l.id in seleccion);
  const total = seleccionados.reduce((acc, l) => {
    const descuento = Number(seleccion[l.id] || 0);
    return acc + Number(l.pvpCampania) * (1 - descuento / 100);
  }, 0);

  async function guardar() {
    setError(null);
    if (esNuevo && !sku.trim()) {
      setError('El pack necesita un SKU.');
      return;
    }
    if (esNuevo && !nombre.trim()) {
      setError('El pack necesita un nombre.');
      return;
    }
    if (seleccionados.length === 0) {
      setError('Elegí al menos un componente.');
      return;
    }
    setGuardando(true);
    try {
      const componentes = seleccionados.map((l) => ({ catalogLineId: l.id, descuentoPct: Number(seleccion[l.id] || 0) }));
      let packId = pack?.id;
      if (!packId) {
        const creado = await apiFetch<{ id: string }>('/catalogo/admin/lineas', {
          method: 'POST',
          body: { catalogId: catalogoId, sku: sku.trim(), nombre: nombre.trim(), pvpCampania: 0.01 },
        });
        packId = creado.id;
      }
      await apiFetch(`/catalogo/admin/lineas/${packId}/pack`, { method: 'PATCH', body: { componentes } });
      onGuardado();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo guardar el pack.');
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center" onClick={onClose}>
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-card bg-crema p-4 shadow-lg sm:rounded-card"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-bosque">{esNuevo ? 'Nuevo pack' : `Editar componentes · ${pack.sku}`}</p>
          <button aria-label="Cerrar" onClick={onClose} className="rounded-pill bg-white px-3 py-1 text-sm text-bosque shadow-sm">✕</button>
        </div>

        {esNuevo && (
          <div className="mt-3 grid grid-cols-2 gap-2 rounded-card bg-white p-3 shadow-sm">
            <div>
              <label className="block text-xs font-medium uppercase text-bosque/60">SKU</label>
              <input value={sku} onChange={(e) => setSku(e.target.value)} className="mt-1 w-full rounded-pill border border-musgo/30 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium uppercase text-bosque/60">Nombre</label>
              <input value={nombre} onChange={(e) => setNombre(e.target.value)} className="mt-1 w-full rounded-pill border border-musgo/30 px-3 py-2 text-sm" />
            </div>
            <p className="col-span-2 text-[11px] text-bosque/40">La foto se agrega después, desde Catálogo/Precios.</p>
          </div>
        )}

        {seleccionados.length > 0 && (
          <div className="mt-3 space-y-1 rounded-card bg-white p-3 shadow-sm">
            <p className="text-xs font-medium uppercase text-bosque/60">Componentes elegidos</p>
            {seleccionados.map((l) => (
              <div key={l.id} className="flex items-center gap-2">
                <span className="flex-1 text-sm text-bosque">{l.nombre ?? l.sku}</span>
                <span className="text-xs text-bosque/50">S/ {Number(l.pvpCampania).toFixed(2)}</span>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step="1"
                    value={seleccion[l.id]}
                    onChange={(e) => setDescuento(l.id, e.target.value)}
                    className="w-16 rounded-pill border border-musgo/30 px-2 py-1 text-right text-xs"
                  />
                  <span className="text-xs text-bosque/50">% dcto.</span>
                </div>
                <button type="button" onClick={() => toggle(l.id)} className="text-bosque/50 hover:text-acento">✕</button>
              </div>
            ))}
            <p className="border-t border-musgo/15 pt-2 text-right text-sm font-medium text-acento">Total: S/ {total.toFixed(2)}</p>
          </div>
        )}

        <div className="mt-3">
          <FiltrosCatalogo
            busqueda={busqueda}
            onBusqueda={setBusqueda}
            categoria={categoria}
            onCategoria={setCategoria}
            categorias={categorias}
            subcategoria={subcategoria}
            onSubcategoria={setSubcategoria}
            subcategorias={subcategorias}
            tipo={tipo}
            onTipo={setTipo}
            tipos={tipos}
          />
        </div>

        <div className="mt-2 max-h-56 space-y-1 overflow-y-auto rounded-card bg-white p-2 shadow-sm">
          {filtrados.map((l) => (
            <label key={l.id} className="flex items-center gap-2 rounded-card px-2 py-1.5 text-sm hover:bg-crema">
              <input type="checkbox" checked={l.id in seleccion} onChange={() => toggle(l.id)} />
              <span className="flex-1">{l.nombre ?? l.sku}</span>
              <span className="text-xs text-bosque/40">S/ {Number(l.pvpCampania).toFixed(2)}</span>
            </label>
          ))}
          {filtrados.length === 0 && <p className="px-2 py-1.5 text-xs text-bosque/50">Ningún producto coincide con los filtros.</p>}
        </div>

        <ErrorBanner mensaje={error} />

        <button
          onClick={guardar}
          disabled={guardando}
          className="mt-3 w-full rounded-pill bg-bosque py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {guardando ? 'Guardando…' : esNuevo ? 'Crear pack' : 'Guardar componentes'}
        </button>
      </div>
    </div>
  );
}
