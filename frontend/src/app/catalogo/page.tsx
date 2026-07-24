// Pantalla "Catálogo" — replica el mockup compartido: cabecera del asesor
// con nivel/comisión, banner de campaña del mes, chips de canal y tarjetas
// de producto con PVP tachado + precio asesor. Los datos son de ejemplo;
// reemplazar por fetch a GET /api/catalogo (backend/src/modules/catalog).

type Producto = {
  sku: string;
  nombre: string;
  pvp: number;
  precioAsesor: number;
  imagen?: string;
};

const PRODUCTOS_EJEMPLO: Producto[] = [
  { sku: 'HSK-SH-400', nombre: 'Shampoo Reparador Keratina 400ml', pvp: 89.9, precioAsesor: 71.92 },
];

export default function CatalogoPage() {
  return (
    <div className="space-y-3">
      <header className="rounded-card bg-bosque p-4 text-white">
        <p className="text-sm opacity-90">Hola, Rosa Mendoza</p>
        <span className="mt-1 inline-block rounded-pill bg-acento px-3 py-1 text-xs font-medium">Nivel Oro</span>
        <span className="ml-2 text-xs opacity-80">Puesto #12 de 340</span>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <div className="rounded-card bg-white/10 p-3">
            <p className="text-xs opacity-80">Ventas del mes</p>
            <p className="text-lg font-medium">S/ 4,850</p>
          </div>
          <div className="rounded-card bg-white/10 p-3">
            <p className="text-xs opacity-80">Comisión acumulada</p>
            <p className="text-lg font-medium">S/ 970</p>
          </div>
        </div>
      </header>

      <div className="flex items-center justify-between rounded-card bg-gradient-to-r from-promo to-promo-light p-4 text-bosque-dark">
        <div>
          <p className="text-xs font-medium">Campaña de julio</p>
          <p className="font-medium">Kit Reparación Total −25%</p>
        </div>
        <button className="rounded-pill bg-bosque px-3 py-2 text-xs font-medium text-white">Ver oferta</button>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {['Todos', 'Salones de Belleza', 'Retail', 'Comercio Minorista'].map((canal, i) => (
          <button
            key={canal}
            className={
              i === 0
                ? 'shrink-0 rounded-pill bg-musgo px-4 py-2 text-sm font-medium text-white'
                : 'shrink-0 rounded-pill border border-musgo/40 px-4 py-2 text-sm text-bosque'
            }
          >
            {canal}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {PRODUCTOS_EJEMPLO.map((p) => (
          <article key={p.sku} className="rounded-card bg-white p-3 shadow-sm">
            <span className="rounded-pill bg-musgo/20 px-2 py-1 text-xs font-medium text-musgo-dark">Salones de Belleza</span>
            {p.imagen ? (
              <img src={p.imagen} alt={p.nombre} className="my-3 h-40 w-full rounded-card object-cover" />
            ) : (
              <div className="my-3 flex h-40 items-center justify-center rounded-card border border-dashed border-musgo/30 text-xs text-bosque/50">
                foto producto
              </div>
            )}
            <p className="font-medium">{p.nombre}</p>
            <p className="text-xs text-musgo-dark">En stock</p>
            <p className="mt-1 text-sm text-bosque/50 line-through">S/{p.pvp.toFixed(2)}</p>
            <p className="text-lg font-medium text-acento">S/ {p.precioAsesor.toFixed(2)}</p>
            <button className="mt-2 w-full rounded-pill bg-bosque py-2 text-sm font-medium text-white">Agregar</button>
          </article>
        ))}
      </div>
    </div>
  );
}
