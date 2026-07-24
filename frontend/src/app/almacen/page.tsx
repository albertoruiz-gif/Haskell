// Pantalla "Almacén" — replica el mockup: picking por ubicación/cantidad
// (RF-024/RF-025), selección de tamaño de bulto para packing (RF-026).
// El botón de packing queda deshabilitado hasta cerrar el picking (RN-020/RF-025).

const LINEAS_PICKING = [
  { sku: 'HSK-SH-400', nombre: 'Shampoo Reparador Keratina 400ml', ubicacion: 'A-12', cantidad: 2 },
  { sku: 'HSK-KIT-REP', nombre: 'Kit Reparación Total', ubicacion: 'B-04', cantidad: 1 },
  { sku: 'HSK-SER-BRI', nombre: 'Sérum Finalizador Brillo', ubicacion: 'C-21', cantidad: 1 },
];

export default function AlmacenPage() {
  return (
    <div className="space-y-3">
      <div>
        <h1 className="text-lg font-medium text-bosque">Pedido #00234</h1>
        <p className="text-xs text-bosque/60">Rosa Mendoza — Los Olivos</p>
      </div>

      <div className="flex gap-1 rounded-pill bg-white p-1 shadow-sm">
        {['Pendiente', 'Picking', 'Empacado', 'Listo para envío'].map((estado, i) => (
          <span
            key={estado}
            className={
              i === 0
                ? 'flex-1 rounded-pill bg-bosque py-2 text-center text-xs font-medium text-white'
                : 'flex-1 py-2 text-center text-xs text-bosque/50'
            }
          >
            {estado}
          </span>
        ))}
      </div>

      <div className="rounded-card bg-white p-3 shadow-sm">
        <p className="text-sm font-medium text-bosque">Picking</p>
        <div className="mt-2 space-y-2">
          {LINEAS_PICKING.map((linea) => (
            <label key={linea.sku} className="flex items-center gap-2 rounded-card bg-crema p-2">
              <input type="checkbox" className="h-4 w-4 accent-musgo" />
              <div className="h-8 w-8 shrink-0 rounded-card border border-dashed border-musgo/30" />
              <div>
                <p className="text-sm font-medium">{linea.nombre}</p>
                <p className="text-xs text-bosque/60">Ubicación {linea.ubicacion} · Cant. {linea.cantidad}</p>
              </div>
            </label>
          ))}
        </div>
      </div>

      <div className="rounded-card bg-white p-3 shadow-sm">
        <p className="text-sm font-medium text-bosque">Packing</p>
        <p className="mt-1 text-xs font-medium uppercase text-bosque/60">Tamaño de caja</p>
        <div className="mt-2 flex gap-2">
          {['Chica', 'Mediana', 'Grande'].map((tam) => (
            <button
              key={tam}
              className={
                tam === 'Mediana'
                  ? 'flex-1 rounded-pill bg-musgo py-2 text-sm font-medium text-white'
                  : 'flex-1 rounded-pill border border-musgo/30 py-2 text-sm text-bosque'
              }
            >
              {tam}
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs text-bosque/60">Peso estimado: 1.40 kg</p>
      </div>

      <button disabled className="w-full rounded-pill bg-musgo/30 py-3 text-sm font-medium text-white/80">
        Completa el picking primero
      </button>
    </div>
  );
}
