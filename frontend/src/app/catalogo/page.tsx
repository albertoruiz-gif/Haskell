'use client';

// Pantalla "Catálogo" — catálogo vigente del asesor (RF-011/012/013,
// filtrado por canal en servidor, RF-048). Se trae una sola vez y se filtra
// en el cliente por categoría/subcategoría/tipo y por búsqueda (nombre o
// código/SKU), así la respuesta es instantánea mientras se escribe. Al
// elegir un producto se abre su ficha completa (fotos, descripción,
// beneficios, propiedades, precio y oferta vigente si hay).

import { useEffect, useState } from 'react';
import { apiFetch, ApiError, resolveAssetUrl } from '../../lib/api';
import { getUsuario } from '../../lib/auth';
import { useCart } from '../../components/cart/CartContext';
import { ProductoDetalle, ProductoCompleto } from '../../components/catalogo/ProductoDetalle';
import { FiltrosCatalogo } from '../../components/catalogo/FiltrosCatalogo';
import { useFiltrosCatalogo } from '../../lib/useFiltrosCatalogo';
import { ErrorBanner } from '../../components/ui/ErrorBanner';

type RespuestaCatalogo = { canal: string | null; catalogoId?: string; productos: ProductoCompleto[] };

export default function CatalogoPage() {
  const { agregar } = useCart();
  const [productos, setProductos] = useState<ProductoCompleto[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);
  const [seleccionado, setSeleccionado] = useState<ProductoCompleto | null>(null);
  const [agregados, setAgregados] = useState<Set<string>>(new Set());

  function agregarConFeedback(p: ProductoCompleto) {
    agregar({ catalogLineId: p.id, sku: p.sku, nombre: p.nombre ?? p.sku, precioUnitario: p.precioAsesor });
    setAgregados((prev) => new Set(prev).add(p.sku));
    setTimeout(() => {
      setAgregados((prev) => {
        const copia = new Set(prev);
        copia.delete(p.sku);
        return copia;
      });
    }, 1500);
  }

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
  } = useFiltrosCatalogo(productos);

  // Se agrupa por linea (Cavalo Forte, Bendito Loiro...) para los
  // encabezados de sección — agrupar por categoría no serviría, hoy es un
  // solo valor ("Tratamientos capilares") para todo el catálogo.
  const porLinea = filtrados.reduce<Record<string, ProductoCompleto[]>>((acc, p) => {
    const key = p.linea ?? p.categoria ?? 'Otros';
    (acc[key] ??= []).push(p);
    return acc;
  }, {});

  const esVistaAdmin = !getUsuario()?.canal;

  return (
    <div className="space-y-3">
      <header className="rounded-card bg-bosque p-4 text-white">
        <p className="text-sm opacity-90">Catálogo vigente</p>
      </header>

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

      <ErrorBanner mensaje={error} />
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

      {esVistaAdmin && !cargando && productos.length > 0 && (
        <p className="rounded-card bg-musgo/10 p-2 text-xs text-bosque/70">
          Vista previa de administrador: se muestran los productos publicados de todos los canales (los asesores solo ven los de su propio canal).
        </p>
      )}

      {Object.entries(porLinea).map(([lineaNombre, items]) => (
        <div key={lineaNombre} className="space-y-2">
          <h2 className="text-sm font-medium text-bosque">{lineaNombre}</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {items.map((p) => (
              <article key={p.sku} className="rounded-card bg-white p-3 shadow-sm">
                <div className="mb-2 flex gap-1">
                  {esVistaAdmin && (
                    <span className="inline-block rounded-pill bg-musgo/20 px-2 py-1 text-xs font-medium text-musgo-dark">{p.canal}</span>
                  )}
                  {p.componentes.length > 0 && (
                    <span className="inline-block rounded-pill bg-acento/15 px-2 py-1 text-xs font-medium text-acento">Pack</span>
                  )}
                </div>
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
                  onClick={() => agregarConFeedback(p)}
                  className={`mt-2 w-full rounded-pill py-2 text-sm font-medium text-white transition-colors ${
                    agregados.has(p.sku) ? 'bg-musgo' : 'bg-bosque'
                  }`}
                >
                  {agregados.has(p.sku) ? '✓ Agregado al carrito' : 'Agregar'}
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
          onAgregar={() => agregarConFeedback(seleccionado)}
        />
      )}
    </div>
  );
}
