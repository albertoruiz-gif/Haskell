'use client';

// UI de filtros compartida entre el Catálogo del asesor y Catálogo/Precios
// en Gestión — la lógica de cascada vive en useFiltrosCatalogo.

type Props = {
  busqueda: string;
  onBusqueda: (v: string) => void;
  categoria: string;
  onCategoria: (v: string) => void;
  categorias: string[];
  subcategoria: string;
  onSubcategoria: (v: string) => void;
  subcategorias: string[];
  tipo: string;
  onTipo: (v: string) => void;
  tipos: string[];
};

const TODAS = 'Todas';

function estiloSelect(activo: boolean) {
  return `w-full rounded-pill border px-3 py-2 text-sm ${activo ? 'border-acento text-acento' : 'border-musgo/30 text-bosque'}`;
}

export function FiltrosCatalogo({
  busqueda,
  onBusqueda,
  categoria,
  onCategoria,
  categorias,
  subcategoria,
  onSubcategoria,
  subcategorias,
  tipo,
  onTipo,
  tipos,
}: Props) {
  return (
    <div className="space-y-2 rounded-card bg-white p-2 shadow-sm">
      <div className="relative">
        <input
          type="search"
          placeholder="Buscar por nombre o código..."
          value={busqueda}
          onChange={(e) => onBusqueda(e.target.value)}
          className={`w-full rounded-pill border px-3 py-2 text-sm outline-none transition-colors ${
            busqueda ? 'border-acento ring-1 ring-acento/30' : 'border-musgo/30'
          }`}
        />
        {busqueda && (
          <button
            aria-label="Limpiar búsqueda"
            onClick={() => onBusqueda('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-bosque/40 hover:text-acento"
          >
            ✕
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <div>
          <label className="block px-1 text-[11px] font-medium uppercase text-bosque/50">Categoría</label>
          <select value={categoria} onChange={(e) => onCategoria(e.target.value)} className={estiloSelect(categoria !== TODAS)}>
            {categorias.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block px-1 text-[11px] font-medium uppercase text-bosque/50">Subcategoría</label>
          <select value={subcategoria} onChange={(e) => onSubcategoria(e.target.value)} className={estiloSelect(subcategoria !== TODAS)}>
            {subcategorias.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block px-1 text-[11px] font-medium uppercase text-bosque/50">Tipo</label>
          <select value={tipo} onChange={(e) => onTipo(e.target.value)} className={estiloSelect(tipo !== TODAS)}>
            {tipos.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
