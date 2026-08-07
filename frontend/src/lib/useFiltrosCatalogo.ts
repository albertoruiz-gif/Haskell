import { useEffect, useMemo, useState } from 'react';

// Filtro en cascada reutilizable: Subcategoría se acota a lo que existe
// dentro de la Categoría elegida, y Tipo a lo que existe dentro de la
// Subcategoría (y Categoría) elegidas — así no se puede armar una
// combinación que dé 0 resultados. Usado por el Catálogo del asesor y por
// Catálogo/Precios en Gestión (antes vivía duplicado en cada pantalla).
export const TODAS = 'Todas';

export type TipoProductoFiltro = 'todos' | 'individual' | 'pack';

type ProductoFiltrable = {
  sku: string;
  nombre?: string | null;
  categoria?: string | null;
  subcategoria?: string | null;
  tipo?: string | null;
  // Cualquiera de las dos formas sirve para detectar si es un pack — el
  // catálogo del asesor ya trae "esPack" resuelto, Catálogo/Precios en
  // Gestión trae la relación completa "packComponentes".
  esPack?: boolean;
  packComponentes?: unknown[];
};

function esPackDe(p: ProductoFiltrable): boolean {
  return p.esPack ?? (p.packComponentes ? p.packComponentes.length > 0 : false);
}

// Minusculas y sin tildes, para que buscar "champu" encuentre "Champú" y
// viceversa sin importar como lo haya escrito cada uno. Rango \u0300-\u036f
// son las marcas diacriticas combinables que deja "champú".normalize('NFD').
const MARCAS_DIACRITICAS = /[\u0300-\u036f]/g;

function normalizar(s: string): string {
  return s.normalize('NFD').replace(MARCAS_DIACRITICAS, '').toLowerCase();
}

// Sinonimos comerciales reales del rubro — la misma palabra tiene mas de un
// nombre valido (ej. "champú"/"shampoo") y buscar uno debe encontrar el otro.
const GRUPOS_SINONIMOS: string[][] = [['champu', 'shampoo']];

function palabraCanonica(palabra: string): string {
  const grupo = GRUPOS_SINONIMOS.find((g) => g.includes(palabra));
  return grupo ? grupo[0] : palabra;
}

// Separa el termino de busqueda en palabras sueltas (ignora espacios,
// parentesis y signos, pero NO el guion de un SKU como "hsk-0017") y exige
// que TODAS esten presentes (en el nombre o en el SKU) sin importar el
// orden. Necesario porque Hasky recomienda productos en Live Chat con el
// formato "Nombre del producto (HSK-xxxx)" pensado para copiar y pegar acá
// — con un simple "el texto incluye el termino completo" nunca matchea,
// porque ni el nombre solo ni el SKU solo contienen esa cadena completa.
// Antes de esto, ademas, bastaba con que la palabra "champu"/"shampoo"
// apareciera en cualquier lado para dar por buena TODA la busqueda (bug:
// pegar la recomendacion completa traia todos los champús, no solo el
// recomendado).
function tokenizar(terminoNormalizado: string): string[] {
  return terminoNormalizado
    .split(/[^a-z0-9ñ-]+/)
    .filter(Boolean)
    .map(palabraCanonica);
}

function coincideTexto(nombreNormalizado: string, skuNormalizado: string, terminoNormalizado: string): boolean {
  const tokens = tokenizar(terminoNormalizado);
  if (tokens.length === 0) return true;
  return tokens.every((token) => nombreNormalizado.includes(token) || skuNormalizado.includes(token));
}

function opcionesDe<T extends ProductoFiltrable>(productos: T[], campo: 'categoria' | 'subcategoria' | 'tipo') {
  const set = new Set(productos.map((p) => p[campo] ?? 'Otros'));
  return [TODAS, ...Array.from(set).sort((a, b) => a.localeCompare(b, 'es'))];
}

export function useFiltrosCatalogo<T extends ProductoFiltrable>(productos: T[]) {
  const [busqueda, setBusqueda] = useState('');
  const [categoria, setCategoria] = useState(TODAS);
  const [subcategoria, setSubcategoria] = useState(TODAS);
  const [tipo, setTipo] = useState(TODAS);
  const [tipoProducto, setTipoProducto] = useState<TipoProductoFiltro>('todos');

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
    const termino = normalizar(busqueda.trim());
    const resultado = productos.filter((p) => {
      const coincideCategoria = categoria === TODAS || (p.categoria ?? 'Otros') === categoria;
      const coincideSubcategoria = subcategoria === TODAS || (p.subcategoria ?? 'Otros') === subcategoria;
      const coincideTipo = tipo === TODAS || (p.tipo ?? 'Otros') === tipo;
      const coincideTipoProducto = tipoProducto === 'todos' || (tipoProducto === 'pack') === esPackDe(p);
      const coincideBusqueda = coincideTexto(normalizar(p.nombre ?? ''), normalizar(p.sku), termino);
      return coincideCategoria && coincideSubcategoria && coincideTipo && coincideTipoProducto && coincideBusqueda;
    });

    // Si escribiste un código, la coincidencia exacta de SKU va primero —
    // sin esto, un código que también aparece como substring de otro nombre
    // podía terminar más abajo en la lista.
    if (!termino) return resultado;
    return [...resultado].sort((a, b) => {
      const aExacto = normalizar(a.sku) === termino ? 0 : 1;
      const bExacto = normalizar(b.sku) === termino ? 0 : 1;
      return aExacto - bExacto;
    });
  }, [productos, busqueda, categoria, subcategoria, tipo, tipoProducto]);

  const hayFiltros =
    busqueda.trim().length > 0 || categoria !== TODAS || subcategoria !== TODAS || tipo !== TODAS || tipoProducto !== 'todos';

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
    tipoProducto,
    setTipoProducto,
    filtrados,
    hayFiltros,
  };
}
