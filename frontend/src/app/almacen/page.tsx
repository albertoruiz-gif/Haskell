'use client';

// Pantalla "Almacén" — picking (RF-024/025) y packing (RF-026) sobre
// pedidos ya pagados (RN-020). Desde que un pedido queda empacado, el
// resto del flujo (asignar transportista, seguimiento de despacho, pagos
// a transportistas) vive en Gestión → Transporte, no acá.

import { useEffect, useState } from 'react';
import { apiFetch, ApiError } from '../../lib/api';

type Pedido = {
  id: string;
  referenciaWeb: string;
  estado: string;
  direccionSnapshot: { distrito?: string };
  asesor: { user: { nombre: string } };
};

type PickingInfo = {
  pedido: string;
  asesor: string;
  lineas: { sku: string; nombre: string; cantidad: number }[];
};

const TAMANOS = ['Chica', 'Mediana', 'Grande'];
const PASOS = [
  { estado: 'PAGADO', label: 'Pendiente' },
  { estado: 'PICKING', label: 'Picking' },
  { estado: 'PACKING', label: 'Empacado' },
];

export default function AlmacenPage() {
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [seleccionado, setSeleccionado] = useState<Pedido | null>(null);
  const [picking, setPicking] = useState<PickingInfo | null>(null);
  const [marcados, setMarcados] = useState<Set<string>>(new Set());
  const [tamano, setTamano] = useState('Mediana');
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);
  const [procesando, setProcesando] = useState(false);

  async function cargarPedidos() {
    setCargando(true);
    setError(null);
    try {
      const [pagados, pickingL, packing] = await Promise.all([
        apiFetch<Pedido[]>('/orders?estado=PAGADO'),
        apiFetch<Pedido[]>('/orders?estado=PICKING'),
        apiFetch<Pedido[]>('/orders?estado=PACKING'),
      ]);
      setPedidos([...pagados, ...pickingL, ...packing]);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo cargar los pedidos.');
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    cargarPedidos();
  }, []);

  async function seleccionar(p: Pedido) {
    setSeleccionado(p);
    setPicking(null);
    setMarcados(new Set());
    setError(null);
    if (p.estado === 'PAGADO') {
      try {
        const info = await apiFetch<PickingInfo>(`/operaciones/pedidos/${p.id}/picking`);
        setPicking(info);
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'No se pudo cargar el detalle del pedido.');
      }
    }
  }

  function toggleMarcado(sku: string) {
    setMarcados((prev) => {
      const copia = new Set(prev);
      copia.has(sku) ? copia.delete(sku) : copia.add(sku);
      return copia;
    });
  }

  async function confirmarPicking() {
    if (!seleccionado) return;
    setProcesando(true);
    setError(null);
    try {
      await apiFetch(`/operaciones/pedidos/${seleccionado.id}/picking/confirmar`, { method: 'POST', body: {} });
      await cargarPedidos();
      setSeleccionado(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo confirmar el picking.');
    } finally {
      setProcesando(false);
    }
  }

  async function confirmarPacking() {
    if (!seleccionado) return;
    setProcesando(true);
    setError(null);
    try {
      await apiFetch(`/operaciones/pedidos/${seleccionado.id}/packing/confirmar`, { method: 'POST', body: { bultos: 1 } });
      await cargarPedidos();
      setSeleccionado(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo confirmar el empacado.');
    } finally {
      setProcesando(false);
    }
  }

  if (!seleccionado) {
    return (
      <div className="space-y-3">
        <h1 className="text-lg font-medium text-bosque">Almacén</h1>
        {error && <p className="text-xs text-red-600">{error}</p>}
        {cargando && <p className="text-xs text-bosque/50">Cargando pedidos…</p>}
        {!cargando && pedidos.length === 0 && <p className="text-xs text-bosque/50">No hay pedidos pagados esperando picking/packing.</p>}
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {pedidos.map((p) => (
            <button
              key={p.id}
              onClick={() => seleccionar(p)}
              className="flex w-full items-center justify-between rounded-card bg-white p-3 text-left shadow-sm"
            >
              <div>
                <p className="text-sm font-medium">Pedido {p.referenciaWeb} · {p.asesor.user.nombre}</p>
                <p className="text-xs text-bosque/60">{p.direccionSnapshot?.distrito ?? 'Sin distrito'}</p>
              </div>
              <span className="rounded-pill bg-musgo/20 px-3 py-1 text-xs font-medium text-musgo-dark">
                {PASOS.find((s) => s.estado === p.estado)?.label ?? p.estado}
              </span>
            </button>
          ))}
        </div>
        {pedidos.some((p) => p.estado === 'PACKING') && (
          <p className="text-xs text-bosque/50">
            Los pedidos ya empacados se asignan a un transportista desde la pestaña <strong>Delivery</strong>.
          </p>
        )}
      </div>
    );
  }

  const pasoActualIdx = PASOS.findIndex((s) => s.estado === seleccionado.estado);

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-lg font-medium text-bosque">Pedido {seleccionado.referenciaWeb}</h1>
          <p className="text-xs text-bosque/60">{seleccionado.asesor.user.nombre} — {seleccionado.direccionSnapshot?.distrito}</p>
        </div>
        <button onClick={() => setSeleccionado(null)} className="rounded-pill bg-white px-3 py-1 text-xs text-bosque shadow-sm">
          ← Volver
        </button>
      </div>

      <div className="flex gap-1 rounded-pill bg-white p-1 shadow-sm">
        {PASOS.map((paso, i) => (
          <span
            key={paso.estado}
            className={
              i === pasoActualIdx
                ? 'flex-1 rounded-pill bg-bosque py-2 text-center text-xs font-medium text-white'
                : 'flex-1 py-2 text-center text-xs text-bosque/50'
            }
          >
            {paso.label}
          </span>
        ))}
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}

      {seleccionado.estado === 'PAGADO' && (
        <div className="rounded-card bg-white p-3 shadow-sm">
          <p className="text-sm font-medium text-bosque">Picking</p>
          <div className="mt-2 space-y-2">
            {picking?.lineas.map((linea) => (
              <label key={linea.sku} className="flex items-center gap-2 rounded-card bg-crema p-2">
                <input type="checkbox" checked={marcados.has(linea.sku)} onChange={() => toggleMarcado(linea.sku)} className="h-4 w-4 accent-musgo" />
                <div className="h-8 w-8 shrink-0 rounded-card border border-dashed border-musgo/30" />
                <div>
                  <p className="text-sm font-medium">{linea.nombre}</p>
                  <p className="text-xs text-bosque/60">SKU {linea.sku} · Cant. {linea.cantidad}</p>
                </div>
              </label>
            ))}
            {!picking && <p className="text-xs text-bosque/50">Cargando líneas…</p>}
          </div>
          <button
            onClick={confirmarPicking}
            disabled={!picking || marcados.size < picking.lineas.length || procesando}
            className="mt-3 w-full rounded-pill bg-bosque py-3 text-sm font-medium text-white disabled:bg-musgo/30 disabled:text-white/80"
          >
            {!picking || marcados.size < (picking?.lineas.length ?? 1) ? 'Marcá todas las líneas para continuar' : procesando ? 'Confirmando…' : 'Confirmar picking'}
          </button>
        </div>
      )}

      {seleccionado.estado === 'PICKING' && (
        <div className="rounded-card bg-white p-3 shadow-sm">
          <p className="text-sm font-medium text-bosque">Packing</p>
          <p className="mt-1 text-xs font-medium uppercase text-bosque/60">Tamaño de caja</p>
          <div className="mt-2 flex gap-2">
            {TAMANOS.map((t) => (
              <button
                key={t}
                onClick={() => setTamano(t)}
                className={t === tamano ? 'flex-1 rounded-pill bg-musgo py-2 text-sm font-medium text-white' : 'flex-1 rounded-pill border border-musgo/30 py-2 text-sm text-bosque'}
              >
                {t}
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-bosque/50">El tamaño es referencial — todavía no hay campo en el pedido para guardarlo.</p>
          <button onClick={confirmarPacking} disabled={procesando} className="mt-3 w-full rounded-pill bg-bosque py-3 text-sm font-medium text-white disabled:opacity-60">
            {procesando ? 'Confirmando…' : 'Confirmar empacado'}
          </button>
        </div>
      )}

      {seleccionado.estado === 'PACKING' && (
        <div className="rounded-card bg-white p-3 shadow-sm">
          <p className="text-sm text-bosque">Este pedido ya está empacado. Para asignarle un transportista, andá a la pestaña <strong>Delivery</strong>.</p>
        </div>
      )}
    </div>
  );
}
