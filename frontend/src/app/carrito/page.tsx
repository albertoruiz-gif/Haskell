'use client';

// Pantalla "Carrito" — items con +/-, buscador para seguir agregando
// productos sin volver al catálogo, dirección con selector de distrito
// (tarifa se recalcula en el servidor, RF-016), subtotal/envío/total, y
// checkout que crea un pedido real (POST /orders). Cargo automático real
// vía Culqi + Yape (RF-018 a RF-021, PROMPT_culqi_integracion.md): se
// tokeniza el Yape del cliente en el frontend (nunca la llave privada) y
// se cobra en POST /orders/:id/pagar. Si el cargo automático falla, un
// gerente puede resolverlo a mano en Gestión → Pagos (override de
// excepción, ya no es el camino principal).

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Script from 'next/script';
import { apiFetch, ApiError } from '../../lib/api';
import { formatearNumeroPedido } from '../../lib/numeroPedido';
import { useCart } from '../../components/cart/CartContext';
import { ErrorBanner } from '../../components/ui/ErrorBanner';
import { ResumenPremios } from '../../components/premios/ResumenPremios';

type ProductoBusqueda = { id: string; sku: string; nombre: string | null; precioAsesor: number };
type Pedido = { id: string; numero: number; canal: string; referenciaWeb: string };

declare global {
  interface Window {
    Culqi?: any;
  }
}

export default function CarritoPage() {
  const router = useRouter();
  const { items, actualizarCantidad, agregar, vaciar } = useCart();
  const [busqueda, setBusqueda] = useState('');
  const [resultados, setResultados] = useState<ProductoBusqueda[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [pagando, setPagando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pedidoOk, setPedidoOk] = useState<string | null>(null);
  const [pedidoRechazado, setPedidoRechazado] = useState<string | null>(null);

  // Pedido ya creado (PENDIENTE_PAGO), esperando el celular/código Yape.
  const [pedidoPendiente, setPedidoPendiente] = useState<Pedido | null>(null);
  const [celularYape, setCelularYape] = useState('');
  const [codigoYape, setCodigoYape] = useState('');
  const [culqiListo, setCulqiListo] = useState(false);

  useEffect(() => {
    if (!busqueda) {
      setResultados([]);
      return;
    }
    const t = setTimeout(async () => {
      setBuscando(true);
      try {
        const data = await apiFetch<{ productos: ProductoBusqueda[] }>(`/catalogo?busqueda=${encodeURIComponent(busqueda)}`);
        setResultados(data.productos);
      } catch {
        setResultados([]);
      } finally {
        setBuscando(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [busqueda]);

  const subtotal = items.reduce((acc, i) => acc + i.precioUnitario * i.cantidad, 0);
  const envio = items.length > 0 ? 14.0 : 0; // TODO: reemplazar por GET /api/tarifas?distrito=... (RF-016, calculado en servidor)
  const total = subtotal + envio;

  // Paso 1: crea el pedido real (sin cambios) y pasa a pedir celular/código Yape.
  async function crearPedido() {
    setError(null);
    setPagando(true);
    try {
      const pedido = await apiFetch<Pedido>('/orders', {
        method: 'POST',
        body: { items: items.map((i) => ({ catalogLineId: i.catalogLineId, cantidad: i.cantidad })) },
      });
      vaciar();
      setPedidoPendiente(pedido);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo crear el pedido.');
    } finally {
      setPagando(false);
    }
  }

  // Paso 2: tokeniza el Yape con Culqi.js y cobra.
  // NOTA: el nombre exacto del método de Culqi.js para tokenizar Yape no se
  // pudo confirmar contra la documentación oficial (ver PROMPT_culqi_
  // integracion.md, "Qué NO hacer") — createYapeToken es el nombre esperado
  // según el patrón general del SDK v4, pero hay que validarlo con un pago
  // de prueba real antes de salir a producción; si Culqi usa otro nombre,
  // solo hay que ajustar esta función, el resto del flujo no cambia.
  async function pagarConYape() {
    if (!pedidoPendiente) return;
    setError(null);
    setPagando(true);
    try {
      if (!window.Culqi) throw new Error('Culqi.js no cargó todavía — probá de nuevo en un momento.');
      const token: string = await new Promise((resolve, reject) => {
        window.Culqi.publicKey = process.env.NEXT_PUBLIC_CULQI_PUBLIC_KEY;
        window.Culqi.createYapeToken({ phone_number: celularYape.replace(/\D/g, ''), otp: codigoYape }, (err: any, resp: any) => {
          if (err || !resp?.id) reject(new Error(err?.user_message ?? 'No se pudo validar el Yape.'));
          else resolve(resp.id);
        });
      });

      const pago = await apiFetch<{ estado: string; respuestaJson?: { outcome?: { merchant_message?: string } } }>(
        `/orders/${pedidoPendiente.id}/pagar`,
        { method: 'POST', body: { culqiToken: token } },
      );

      if (pago.estado === 'aprobado') {
        setPedidoOk(formatearNumeroPedido(pedidoPendiente.canal, pedidoPendiente.numero) ?? pedidoPendiente.referenciaWeb);
      } else {
        setPedidoRechazado(pago.respuestaJson?.outcome?.merchant_message ?? 'El pago fue rechazado — podés reintentar.');
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : err instanceof Error ? err.message : 'No se pudo procesar el pago.');
    } finally {
      setPagando(false);
    }
  }

  return (
    <>
      <Script src="https://checkout.culqi.com/js/v4" onLoad={() => setCulqiListo(true)} strategy="afterInteractive" />

      {pedidoOk ? (
        <div className="space-y-3 rounded-card bg-white p-4 text-center shadow-sm">
          <p className="text-lg font-medium text-bosque">¡Pedido pagado!</p>
          <p className="text-sm text-bosque/60">Referencia {pedidoOk}. El cargo por Yape se confirmó y el pedido ya está en camino.</p>
          <button onClick={() => router.push('/catalogo')} className="w-full rounded-pill bg-bosque py-2 text-sm font-medium text-white">
            Volver al catálogo
          </button>
        </div>
      ) : pedidoPendiente ? (
        <div className="mx-auto max-w-sm space-y-3 rounded-card bg-white p-4 shadow-sm">
          <p className="text-lg font-medium text-bosque">Pagá con Yape</p>
          <p className="text-sm text-bosque/60">Pedido {pedidoPendiente.referenciaWeb} — S/ {total.toFixed(2)}</p>
          <ErrorBanner mensaje={pedidoRechazado ?? error} />
          <input
            placeholder="Celular Yape (9 dígitos)"
            value={celularYape}
            onChange={(e) => setCelularYape(e.target.value)}
            className="w-full rounded-pill border border-musgo/30 px-3 py-2 text-sm"
          />
          <input
            placeholder="Código de verificación (6 dígitos)"
            value={codigoYape}
            onChange={(e) => setCodigoYape(e.target.value)}
            className="w-full rounded-pill border border-musgo/30 px-3 py-2 text-sm"
          />
          <button
            onClick={pagarConYape}
            disabled={pagando || !culqiListo || celularYape.length < 9 || codigoYape.length < 6}
            className="w-full rounded-pill bg-acento py-3 text-sm font-medium text-white disabled:opacity-50"
          >
            {pagando ? 'Cobrando…' : `Pagar S/ ${total.toFixed(2)} con Yape`}
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <h1 className="text-lg font-medium text-bosque">Tu carrito</h1>

          <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1fr_360px] lg:items-start">
            <div className="space-y-3">
              <div className="relative rounded-card bg-white p-2 shadow-sm">
                <input
                  type="search"
                  placeholder="Buscar por nombre o código para agregar..."
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  className={`w-full rounded-pill border px-3 py-2 text-sm outline-none transition-colors ${
                    busqueda ? 'border-acento ring-1 ring-acento/30' : 'border-musgo/30'
                  }`}
                />
                {busqueda && (
                  <div className="mt-1 space-y-1">
                    {buscando && <p className="px-2 text-xs text-bosque/50">Buscando…</p>}
                    {!buscando && resultados.length === 0 && <p className="px-2 text-xs text-bosque/50">Sin resultados.</p>}
                    {resultados.map((p) => (
                      <button
                        key={p.sku}
                        onClick={() => {
                          agregar({ catalogLineId: p.id, sku: p.sku, nombre: p.nombre ?? p.sku, precioUnitario: p.precioAsesor });
                          setBusqueda('');
                        }}
                        className="flex w-full items-center justify-between rounded-card px-2 py-2 text-left text-sm hover:bg-crema"
                      >
                        <span>{p.nombre ?? p.sku} <span className="text-xs text-bosque/50">({p.sku})</span></span>
                        <span className="text-acento">S/ {p.precioAsesor.toFixed(2)}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {items.length === 0 ? (
                <p className="rounded-card bg-white p-3 text-sm text-bosque/60 shadow-sm">Tu carrito está vacío — buscá un producto arriba para agregarlo.</p>
              ) : (
                <div className="space-y-2 rounded-card bg-white p-3 shadow-sm">
                  {items.map((item) => (
                    <div key={item.sku} className="flex items-center justify-between border-b border-musgo/10 py-2 last:border-0">
                      <div className="flex items-center gap-2">
                        <div className="h-10 w-10 shrink-0 rounded-card border border-dashed border-musgo/30" />
                        <div>
                          <p className="text-sm font-medium">{item.nombre}</p>
                          <p className="text-xs text-acento">S/ {item.precioUnitario.toFixed(2)} c/u</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 rounded-pill bg-crema px-2 py-1">
                        <button aria-label="Restar" onClick={() => actualizarCantidad(item.sku, item.cantidad - 1)} className="text-bosque">−</button>
                        <span className="text-sm">{item.cantidad}</span>
                        <button aria-label="Sumar" onClick={() => actualizarCantidad(item.sku, item.cantidad + 1)} className="text-bosque">+</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-3">
              <ResumenPremios />

              <div className="rounded-card bg-white p-3 shadow-sm">
                <p className="text-sm font-medium text-bosque">Dirección de entrega</p>
                <p className="text-sm text-acento">Se usa tu dirección predeterminada registrada</p>
                <p className="mt-1 text-xs text-bosque/50">El envío se calcula en el servidor según el distrito de esa dirección.</p>
              </div>

              <div className="rounded-card bg-white p-3 shadow-sm">
                <div className="flex justify-between text-sm text-bosque/70">
                  <span>Subtotal</span>
                  <span>S/ {subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm text-bosque/70">
                  <span>Envío (referencial)</span>
                  <span>S/ {envio.toFixed(2)}</span>
                </div>
                <div className="mt-1 flex justify-between border-t border-musgo/10 pt-1 text-base font-medium text-bosque">
                  <span>Total</span>
                  <span>S/ {total.toFixed(2)}</span>
                </div>
                <p className="mt-1 text-[11px] text-bosque/40">El monto final (con envío real) lo calcula el servidor al crear el pedido.</p>
              </div>

              <div className="rounded-card border-2 border-acento bg-white p-3">
                <p className="text-sm font-medium text-bosque">Pagar con Yape</p>
                <div className="mt-2 flex items-center justify-between rounded-pill border-2 border-acento px-3 py-2">
                  <div>
                    <p className="text-sm font-medium text-acento">Yape</p>
                    <p className="text-xs text-bosque/60">Cargo automático — te vamos a pedir tu celular y el código Yape en el siguiente paso</p>
                  </div>
                  <span className="rounded-pill bg-musgo px-2 py-1 text-xs font-medium text-white">Único medio</span>
                </div>
              </div>

              <ErrorBanner mensaje={error} />

              <button
                onClick={crearPedido}
                disabled={items.length === 0 || pagando}
                className="w-full rounded-pill bg-acento py-3 text-sm font-medium text-white disabled:opacity-50"
              >
                {pagando ? 'Creando pedido…' : `Continuar — S/ ${total.toFixed(2)}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
