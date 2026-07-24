// Pantalla "Carrito" — replica el mockup: items con +/-, dirección con
// selector de distrito (tarifa se recalcula en el servidor, RF-016),
// subtotal/envío/total, y checkout Culqi con Yape como único medio (RF-018).

const ITEMS_EJEMPLO = [
  { nombre: 'Shampoo Reparador Keratina 400ml', precioUnitario: 71.92, cantidad: 2 },
  { nombre: 'Kit Reparación Total', precioUnitario: 175.92, cantidad: 1 },
  { nombre: 'Sérum Finalizador Brillo', precioUnitario: 47.92, cantidad: 1 },
];

export default function CarritoPage() {
  const subtotal = ITEMS_EJEMPLO.reduce((acc, i) => acc + i.precioUnitario * i.cantidad, 0);
  const envio = 14.0; // TODO: reemplazar por GET /api/tarifas?distrito=... (RF-016, calculado en servidor)
  const total = subtotal + envio;

  return (
    <div className="space-y-3">
      <h1 className="text-lg font-medium text-bosque">Tu carrito</h1>

      <div className="space-y-2 rounded-card bg-white p-3 shadow-sm">
        {ITEMS_EJEMPLO.map((item) => (
          <div key={item.nombre} className="flex items-center justify-between border-b border-musgo/10 py-2 last:border-0">
            <div className="flex items-center gap-2">
              <div className="h-10 w-10 shrink-0 rounded-card border border-dashed border-musgo/30" />
              <div>
                <p className="text-sm font-medium">{item.nombre}</p>
                <p className="text-xs text-acento">S/ {item.precioUnitario.toFixed(2)} c/u</p>
              </div>
            </div>
            <div className="flex items-center gap-2 rounded-pill bg-crema px-2 py-1">
              <button aria-label="Restar" className="text-bosque">−</button>
              <span className="text-sm">{item.cantidad}</span>
              <button aria-label="Sumar" className="text-bosque">+</button>
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-card bg-white p-3 shadow-sm">
        <p className="text-sm font-medium text-bosque">Dirección de entrega</p>
        <p className="text-sm text-acento">Rosa Mendoza — Av. Los Álamos 245</p>
        <label className="mt-2 block text-xs font-medium uppercase text-bosque/60">Distrito</label>
        <select className="mt-1 w-full rounded-pill border border-musgo/30 px-3 py-2 text-sm">
          <option>Los Olivos — S/ 14</option>
        </select>
      </div>

      <div className="rounded-card bg-white p-3 shadow-sm">
        <div className="flex justify-between text-sm text-bosque/70">
          <span>Subtotal</span>
          <span>S/ {subtotal.toFixed(2)}</span>
        </div>
        <div className="flex justify-between text-sm text-bosque/70">
          <span>Envío a Los Olivos</span>
          <span>S/ {envio.toFixed(2)}</span>
        </div>
        <div className="mt-1 flex justify-between border-t border-musgo/10 pt-1 text-base font-medium text-bosque">
          <span>Total</span>
          <span>S/ {total.toFixed(2)}</span>
        </div>
      </div>

      <div className="rounded-card border-2 border-acento bg-white p-3">
        <p className="text-sm font-medium text-bosque">Pagar con Culqi</p>
        <div className="mt-2 flex items-center justify-between rounded-pill border-2 border-acento px-3 py-2">
          <div>
            <p className="text-sm font-medium text-acento">Yape</p>
            <p className="text-xs text-bosque/60">Paga escaneando el código o con tu número de celular</p>
          </div>
          <span className="rounded-pill bg-musgo px-2 py-1 text-xs font-medium text-white">Único medio</span>
        </div>
      </div>

      <button className="w-full rounded-pill bg-acento py-3 text-sm font-medium text-white">
        Pagar S/ {total.toFixed(2)} con Yape
      </button>
    </div>
  );
}
