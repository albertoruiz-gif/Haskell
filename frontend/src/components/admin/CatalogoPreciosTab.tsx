'use client';

import { useEffect, useState } from 'react';
import { apiFetch, ApiError, resolveAssetUrl } from '../../lib/api';
import { EditarProductoModal, LineaAdmin } from './EditarProductoModal';
import { CatalogosPanel } from './CatalogosPanel';
import { FiltrosCatalogo } from '../catalogo/FiltrosCatalogo';
import { useFiltrosCatalogo } from '../../lib/useFiltrosCatalogo';
import { ErrorBanner } from '../ui/ErrorBanner';

type Catalogo = { id: string; canal: string; version: number; estado: string; campaign: { nombre: string } };
type Linea = LineaAdmin;

type Props = { catalogoId: string; onCambiarCatalogo: (id: string) => void };

export function CatalogoPreciosTab({ catalogoId, onCambiarCatalogo }: Props) {
  const [catalogos, setCatalogos] = useState<Catalogo[]>([]);
  const [lineas, setLineas] = useState<Linea[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [precios, setPrecios] = useState<Record<string, string>>({});
  const [editando, setEditando] = useState<Linea | null>(null);
  const [creando, setCreando] = useState(false);

  const {
    busqueda,
    setBusqueda,
    categoria,
    setCategoria,
    categorias,
    subcategoria,
    setSubcategoria,
    subcategorias,
    tipo,
    setTipo,
    tipos,
    filtrados,
    hayFiltros,
  } = useFiltrosCatalogo(lineas);

  async function cargarCatalogos() {
    try {
      const data = await apiFetch<Catalogo[]>('/campaigns/catalogos');
      setCatalogos(data);
      if (!catalogoId && data.length > 0) onCambiarCatalogo(data[0].id);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo cargar los catálogos.');
    }
  }

  async function cargarLineas(id: string) {
    if (!id) {
      setLineas([]);
      return;
    }
    try {
      const data = await apiFetch<Linea[]>(`/catalogo/admin/lineas?catalogId=${id}`);
      setLineas(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo cargar las líneas del catálogo.');
    }
  }

  useEffect(() => {
    cargarCatalogos();
  }, []);

  useEffect(() => {
    cargarLineas(catalogoId);
  }, [catalogoId]);

  async function guardarPrecio(id: string) {
    setError(null);
    const valor = precios[id];
    if (!valor) return;
    try {
      await apiFetch(`/catalogo/admin/lineas/${id}/precio`, { method: 'PATCH', body: { pvpCampania: Number(valor) } });
      await cargarLineas(catalogoId);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo actualizar el precio.');
    }
  }

  async function subirFoto(id: string, archivo: File) {
    setError(null);
    try {
      const formData = new FormData();
      formData.append('foto', archivo);
      await apiFetch(`/catalogo/admin/lineas/${id}/foto`, { method: 'POST', body: formData, isFormData: true });
      await cargarLineas(catalogoId);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo subir la foto.');
    }
  }

  return (
    <div className="space-y-3">
      <CatalogosPanel onCambio={cargarCatalogos} />

      {catalogos.length === 0 ? (
        <p className="rounded-card bg-white p-3 text-xs text-bosque/60 shadow-sm">
          Todavía no hay ningún catálogo — abrí &quot;Campañas y catálogos&quot; arriba para crear uno.
        </p>
      ) : (
        <>
      {catalogos.length > 1 ? (
        <div className="rounded-card bg-white p-3 shadow-sm lg:max-w-sm">
          <label className="text-xs font-medium uppercase text-bosque/60">Catálogo</label>
          <select value={catalogoId} onChange={(e) => onCambiarCatalogo(e.target.value)} className="mt-1 w-full rounded-pill border border-musgo/30 px-3 py-2 text-sm">
            {catalogos.map((c) => (
              <option key={c.id} value={c.id}>{c.campaign.nombre} · {c.canal} · v{c.version} · {c.estado}</option>
            ))}
          </select>
        </div>
      ) : (
        <p className="text-xs text-bosque/50">
          Catálogo: <span className="font-medium text-bosque">{catalogos[0].campaign.nombre} · {catalogos[0].canal} · v{catalogos[0].version} · {catalogos[0].estado}</span>
        </p>
      )}

      <div className="rounded-card bg-white p-3 shadow-sm lg:max-w-sm">
        <p className="text-sm font-medium text-bosque">Producto nuevo</p>
        <p className="mt-1 text-xs text-bosque/50">El portafolio de Haskell ya está cargado — esto es para cuando se suma un producto que todavía no existe.</p>
        <button onClick={() => setCreando(true)} className="mt-2 w-full rounded-pill bg-bosque py-2 text-sm font-medium text-white">
          + Nuevo producto
        </button>
      </div>

      <ErrorBanner mensaje={error} />

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

      {lineas.length > 0 && (
        <p className="text-xs text-bosque/50">
          {hayFiltros ? `${filtrados.length} de ${lineas.length} productos` : `${lineas.length} productos`}
        </p>
      )}

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {filtrados.map((l) => {
          const esPack = l.packComponentes.length > 0;
          return (
          <div key={l.id} className="rounded-card bg-white p-3 shadow-sm">
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium">{l.nombre ?? l.sku}</p>
              {esPack && <span className="rounded-pill bg-acento/15 px-2 py-0.5 text-[11px] font-medium text-acento">Pack</span>}
            </div>
            <p className="text-xs text-bosque/50">{l.sku} {l.linea && <>· {l.linea}</>}</p>

            {l.imagenUrl ? (
              <img src={resolveAssetUrl(l.imagenUrl)} alt={l.sku} className="my-3 h-40 w-full rounded-card object-cover" />
            ) : (
              <div className="my-3 flex h-40 items-center justify-center rounded-card border border-dashed border-musgo/30 text-xs text-bosque/50">
                foto producto
              </div>
            )}
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={(e) => e.target.files?.[0] && subirFoto(l.id, e.target.files[0])}
              className="w-full text-xs"
            />

            {esPack ? (
              <p className="mt-2 rounded-card bg-crema px-3 py-2 text-sm text-bosque">
                S/ {Number(l.pvpCampania).toFixed(2)} <span className="text-xs text-bosque/50">· calculado desde sus componentes</span>
              </p>
            ) : (
              <div className="mt-2 flex gap-2">
                <input
                  type="number"
                  step="0.01"
                  defaultValue={l.pvpCampania}
                  onChange={(e) => setPrecios((p) => ({ ...p, [l.id]: e.target.value }))}
                  className="flex-1 rounded-pill border border-musgo/30 px-3 py-2 text-sm"
                />
                <button onClick={() => guardarPrecio(l.id)} className="rounded-pill bg-acento px-4 py-2 text-xs font-medium text-white">
                  Guardar precio
                </button>
              </div>
            )}

            <button
              onClick={() => setEditando(l)}
              className="mt-2 w-full rounded-pill bg-crema py-2 text-xs font-medium text-bosque"
            >
              Ver ficha completa ›
            </button>
          </div>
          );
        })}
        {lineas.length === 0 && <p className="text-xs text-bosque/50">Este catálogo todavía no tiene productos.</p>}
        {lineas.length > 0 && filtrados.length === 0 && (
          <p className="text-xs text-bosque/50">Ningún producto coincide con los filtros elegidos.</p>
        )}
      </div>

      {editando && (
        <EditarProductoModal
          linea={editando}
          onClose={() => setEditando(null)}
          onGuardado={() => {
            setEditando(null);
            cargarLineas(catalogoId);
          }}
          onEliminado={() => {
            setEditando(null);
            cargarLineas(catalogoId);
          }}
        />
      )}

      {creando && (
        <EditarProductoModal
          linea={null}
          catalogId={catalogoId}
          onClose={() => setCreando(false)}
          onGuardado={() => {
            setCreando(false);
            cargarLineas(catalogoId);
          }}
          onEliminado={() => setCreando(false)}
        />
      )}
        </>
      )}
    </div>
  );
}
