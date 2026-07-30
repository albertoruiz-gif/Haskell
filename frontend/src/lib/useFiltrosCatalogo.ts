import { useEffect, useMemo, useState } from 'react';

// Filtro en cascada reutilizable: Subcategoría se acota a lo que existe
// dentro de la Categoría elegida, y Tipo a lo que existe dentro de la
// Subcategoría (y Categoría) elegidas — así no se puede armar una
// combinación que dé 0 resultados. Usado por el Catálogo del asesor y por
// Catálogo/Precios en Gestión (antes vivía duplicado en cada pantalla).
export const TODAS = 'Todas';

type ProductoFiltrable = {
  sku: string;
  nombre?: string | null;
  categoria?: string | null;
  subcategoria?: string | null;
  tipo?: string | null;
};

function opcionesDe<T extends ProductoFiltrable>(productos: T[], campo: 'categoria' | 'subcategoria' | 'tipo') {
  const set = new Set(productos.map((p) => p[campo] ?? 'Otros'));
  return [TODAS, ...Array.from(set).sort((a, b) => a.localeCompare(b, 'es'))];
}

export function useFiltrosCatalogo<T extends ProductoFiltrable>(productos: T[]) {
  const [busqueda, setBusqueda] = useState('');
  const [categoria, setCategoria] = useState(TODAS);
  const [subcategoria, setSubcategoria] = useState(TODAS);
  const [tipo, setTipo] = useState(TODAS);

  const categorias = useMemo(() => opcionesDe(productos, 'categoria'), [productos]);

  const productosPorCategoria = useMemo(
    () => (categoria === TODAS ? productos : productos.filter((p) => (p.categoria ?? 'Otros') === categoria)),
    [productos, categoria],
  );
  const subcategorias = useMemo(() => opcionesDe(productosPorCategoria, 'subcategoria'), [productosPorCategoria]);

  const productosPorSubcategoria = useMemo(
    () => (subcategoria === TODAS ? productosPorCategoria : productosPorCategoria.filter((p) => (p.subcategoria ?? 'Otros') === subcategoria)),
    [productosPorCategoria, subcategoria],
  );
  const tipos = useMemo(() => opcionesDe(productosPorSubcategoria, 'tipo'), [productosPorSubcategoria]);

  // Si al cambiar un filtro de arriba la selección de abajo deja de tener
  // sentido (0 productos posibles), se resetea a "Todas" en vez de dejar
  // una combinación imposible elegida.
  useEffect(() => {
    if (subcategoria !== TODAS && !subcategorias.includes(subcategoria)) setSubcategoria(TODAS);
  }, [subcategorias, subcategoria]);

  useEffect(() => {
    if (tipo !== TODAS && !tipos.includes(tipo)) setTipo(TODAS);
  }, [tipos, tipo]);

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

  const hayFiltros = busqueda.trim().length > 0 || categoria !== TODAS || subcategoria !== TODAS || tipo !== TODAS;

  return {
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
  };
}
