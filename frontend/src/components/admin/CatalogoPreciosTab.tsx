'use client';

import { useEffect, useState } from 'react';
import { apiFetch, ApiError, resolveAssetUrl } from '../../lib/api';
import { EditarProductoModal, LineaAdmin } from './EditarProductoModal';
import { CatalogosPanel } from './CatalogosPanel';

type Catalogo = { id: string; canal: string; version: number; estado: string; campaign: { nombre: string } };
type Linea = LineaAdmin;

export function CatalogoPreciosTab() {
  const [catalogos, setCatalogos] = useState<Catalogo[]>([]);
  const [catalogoId, setCatalogoId] = useState('');
  const [lineas, setLineas] = useState<Linea[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [nuevoSku, setNuevoSku] = useState('');
  const [nuevaCategoria, setNuevaCategoria] = useState('');
  const [nuevoPrecio, setNuevoPrecio] = useState('');
  const [precios, setPrecios] = useState<Record<string, string>>({});
  const [editando, setEditando] = useState<Linea | null>(null);

  async function cargarCatalogos() {
    try {
      const data = await apiFetch<Catalogo[]>('/campaigns/catalogos');
      setCatalogos(data);
      setCatalogoId((actual) => actual || (data.length > 0 ? data[0].id : ''));
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

  async function crearLinea(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await apiFetch('/catalogo/admin/lineas', {
        method: 'POST',
        body: { catalogId: catalogoId, sku: nuevoSku, categoria: nuevaCategoria || undefined, pvpCampania: Number(nuevoPrecio) },
      });
      setNuevoSku('');
      setNuevaCategoria('');
      setNuevoPrecio('');
      await cargarLineas(catalogoId);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo crear el producto.');
    }
  }

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
          Todavía no hay ningún catálogo — abrí "Campañas y catálogos" arriba para crear uno.
        </p>
      ) : (
        <>
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <div className="rounded-card bg-white p-3 shadow-sm">
          <label className="text-xs font-medium uppercase text-bosque/60">Catálogo</label>
          <select value={catalogoId} onChange={(e) => setCatalogoId(e.target.value)} className="mt-1 w-full rounded-pill border border-musgo/30 px-3 py-2 text-sm">
            {catalogos.map((c) => (
              <option key={c.id} value={c.id}>{c.campaign.nombre} · {c.canal} · v{c.version} · {c.estado}</option>
            ))}
          </select>
        </div>

        <form onSubmit={crearLinea} className="space-y-2 rounded-card bg-white p-3 shadow-sm">
          <p className="text-sm font-medium text-bosque">Nuevo producto</p>
          <input required placeholder="SKU" value={nuevoSku} onChange={(e) => setNuevoSku(e.target.value)} className="w-full rounded-pill border border-musgo/30 px-3 py-2 text-sm" />
          <input placeholder="Categoría (opcional)" value={nuevaCategoria} onChange={(e) => setNuevaCategoria(e.target.value)} className="w-full rounded-pill border border-musgo/30 px-3 py-2 text-sm" />
          <input required type="number" step="0.01" placeholder="Precio" value={nuevoPrecio} onChange={(e) => setNuevoPrecio(e.target.value)} className="w-full rounded-pill border border-musgo/30 px-3 py-2 text-sm" />
          <button type="submit" className="w-full rounded-pill bg-bosque py-2 text-sm font-medium text-white">Agregar producto</button>
        </form>
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {lineas.map((l) => (
          <div key={l.id} className="rounded-card bg-white p-3 shadow-sm">
            <p className="text-sm font-medium">{l.nombre ?? l.sku}</p>
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

            <button
              onClick={() => setEditando(l)}
              className="mt-2 w-full rounded-pill bg-crema py-2 text-xs font-medium text-bosque"
            >
              Editar ficha completa / eliminar / oferta
            </button>
          </div>
        ))}
        {lineas.length === 0 && <p className="text-xs text-bosque/50">Este catálogo todavía no tiene productos.</p>}
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
        </>
      )}
    </div>
  );
}
