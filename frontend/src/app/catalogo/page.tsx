'use client';

// Pantalla "Catálogo" — catálogo vigente del asesor (RF-011/012/013,
// filtrado por canal en servidor, RF-048). Se trae una sola vez y se filtra
// en el cliente por categoría/subcategoría/tipo y por búsqueda (nombre o
// código/SKU), así la respuesta es instantánea mientras se escribe. Al
// elegir un producto se abre su ficha completa (fotos, descripción,
// beneficios, propiedades, precio y oferta vigente si hay).

import { useEffect, useMemo, useState } from 'react';
import { apiFetch, ApiError, resolveAssetUrl } from '../../lib/api';
import { getUsuario } from '../../lib/auth';
import { useCart } from '../../components/cart/CartContext';
import { ProductoDetalle, ProductoCompleto } from '../../components/catalogo/ProductoDetalle';

type RespuestaCatalogo = { canal: string | null; catalogoId?: string; productos: ProductoCompleto[] };

const TODAS = 'Todas';

function useFiltroOpciones(productos: ProductoCompleto[], campo: 'categoria' | 'subcategoria' | 'tipo') {
  return useMemo(() => {
    const set = new Set(productos.map((p) => p[campo] ?? 'Otros'));
    return [TODAS, ...Array.from(set).sort((a, b) => a.localeCompare(b, 'es'))];
  }, [productos, campo]);
}

export default function CatalogoPage() {
  const { agregar } = useCart();
  const [productos, setProductos] = useState<ProductoCompleto[]>([]);
  const [busqueda, setBusqueda] = useState('');
  const [categoria, setCategoria] = useState(TODAS);
  const [subcategoria, setSubcategoria] = useState(TODAS);
  const [tipo, setTipo] = useState(TODAS);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);
  const [seleccionado, setSeleccionado] = useState<ProductoCompleto | null>(null);

  useEffect(() => {
    (async () => {
      setCargando(true);
      setError(null);
      try {
        const data = await apiFetch<RespuestaCatalogo>('/catalogo');
        setProductos(data.productos);
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'No se pudo cargar el catálogo.');
      } finally {
        setCargando(false);
      }
    })();
  }, []);

  const categorias = useFiltroOpciones(productos, 'categoria');
  const subcategorias = useFiltroOpciones(productos, 'subcategoria');
  const tipos = useFiltroOpciones(productos, 'tipo');

  const filtrados = useMemo(() => {
    const termino = busqueda.trim().toLowerCase();
    return productos.filter((p) => {
      const coincideCategoria = categoria === TODAS || (p.categoria ?? 'Otros') === categoria;
      const coincideSubcategoria = subcategoria === TODAS || (p.subcategoria ?? 'Otros') === subcategoria;
      const coincideTipo = tipo === TODAS || (p.tipo ?? 'Otros') === tipo;
      const coincideBusqueda =
        !termino || (p.nombre ?? '').toLowerCase().includes(termino) || p.sku.toLowerCase().includes(termino);
      return coincideCategoria && coincideSubcategoria && coincideTipo && coincideBusqueda;
    });
  }, [productos, busqueda, categoria, subcategoria, tipo]);

  const porCategoria = filtrados.reduce<Record<string, ProductoCompleto[]>>((acc, p) => {
    const cat = p.categoria ?? 'Otros';
    (acc[cat] ??= []).push(p);
    return acc;
  }, {});

  const hayFiltros = busqueda.trim().length > 0 || categoria !== TODAS || subcategoria !== TODAS || tipo !== TODAS;

  function estiloSelect(activo: boolean) {
    return `w-full rounded-pill border px-3 py-2 text-sm ${activo ? 'border-acento text-acento' : 'border-musgo/30 text-bosque'}`;
  }

  return (
    <div className="space-y-3">
      <header className="rounded-card bg-bosque p-4 text-white">
        <p className="text-sm opacity-90">Catálogo vigente</p>
      </header>

      <div className="space-y-2 rounded-card bg-white p-2 shadow-sm">
        <div className="relative">
          <input
            type="search"
            placeholder="Buscar por nombre o código..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className={`w-full rounded-pill border px-3 py-2 text-sm outline-none transition-colors ${
              busqueda ? 'border-acento ring-1 ring-acento/30' : 'border-musgo/30'
            }`}
          />
          {busqueda && (
            <button
              aria-label="Limpiar búsqueda"
              onClick={() => setBusqueda('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-bosque/40 hover:text-acento"
            >
              ✕
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <div>
            <label className="block px-1 text-[11px] font-medium uppercase text-bosque/50">Categoría</label>
            <select value={categoria} onChange={(e) => setCategoria(e.target.value)} className={estiloSelect(categoria !== TODAS)}>
              {categorias.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="block px-1 text-[11px] font-medium uppercase text-bosque/50">Subcategoría</label>
            <select value={subcategoria} onChange={(e) => setSubcategoria(e.target.value)} className={estiloSelect(subcategoria !== TODAS)}>
              {subcategorias.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="block px-1 text-[11px] font-medium uppercase text-bosque/50">Tipo</label>
            <select value={tipo} onChange={(e) => setTipo(e.target.value)} className={estiloSelect(tipo !== TODAS)}>
              {tipos.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}
      {cargando && <p className="text-xs text-bosque/50">Cargando catálogo…</p>}
      {!cargando && !error && (
        <p className="text-xs text-bosque/50">
          {hayFiltros ? `${filtrados.length} de ${productos.length} productos` : `${productos.length} productos`}
        </p>
      )}
      {!cargando && productos.length > 0 && filtrados.length === 0 && (
        <p className="text-xs text-bosque/50">Ningún producto coincide con los filtros elegidos.</p>
      )}
      {!cargando && productos.length === 0 && !error && (
        <p className="text-xs text-bosque/50">
          {getUsuario()?.canal
            ? 'No hay productos disponibles para tu canal.'
            : `Tu usuario (${getUsuario()?.rol ?? 'sin rol'}) no tiene un canal de asesor asignado — este catálogo es solo para cuentas de asesor. Cerrá sesión arriba y entrá con una cuenta de asesor para verlo.`}
        </p>
      )}

      {Object.entries(porCategoria).map(([cat, items]) => (
        <div key={cat} className="space-y-2">
          <h2 className="text-sm font-medium text-bosque">{cat}</h2>
          <div className="space-y-3">
            {items.map((p) => (
              <article key={p.sku} className="rounded-card bg-white p-3 shadow-sm">
                <button className="block w-full text-left" onClick={() => setSeleccionado(p)}>
                  {p.imagenUrl ? (
                    <img src={resolveAssetUrl(p.imagenUrl)} alt={p.nombre ?? p.sku} className="my-3 h-40 w-full rounded-card object-cover" />
                  ) : (
                    <div className="my-3 flex h-40 items-center justify-center rounded-card border border-dashed border-musgo/30 text-xs text-bosque/50">
                      foto producto
                    </div>
                  )}
                  <p className="font-medium">{p.nombre ?? p.sku}</p>
                  <p className="text-xs text-bosque/50">{p.sku}</p>
                  <p className="mt-1 text-sm text-bosque/50 line-through">S/{p.pvp.toFixed(2)}</p>
                  <p className="text-lg font-medium text-acento">S/ {p.precioAsesor.toFixed(2)}</p>
                </button>
                <button
                  onClick={() => agregar({ sku: p.sku, nombre: p.nombre ?? p.sku, precioUnitario: p.precioAsesor })}
                  className="mt-2 w-full rounded-pill bg-bosque py-2 text-sm font-medium text-white"
                >
                  Agregar
                </button>
              </article>
            ))}
          </div>
        </div>
      ))}

      {seleccionado && (
        <ProductoDetalle
          producto={seleccionado}
          onClose={() => setSeleccionado(null)}
          onAgregar={() => agregar({ sku: seleccionado.sku, nombre: seleccionado.nombre ?? seleccionado.sku, precioUnitario: seleccionado.precioAsesor })}
        />
      )}
    </div>
  );
}
