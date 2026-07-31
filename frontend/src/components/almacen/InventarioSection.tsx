'use client';

// Inventario de Haskell Perú — se controla desde la nacionalización/ingreso
// al almacén (la compra/embarque/aduanas previa queda fuera de este
// sistema) hasta la venta, devolución o baja de cada lote. FEFO real: el
// pedido reserva primero contra el lote con vencimiento más próximo.

import { useEffect, useMemo, useState } from 'react';
import { apiFetch, ApiError } from '../../lib/api';
import { FiltrosCatalogo } from '../catalogo/FiltrosCatalogo';
import { useFiltrosCatalogo } from '../../lib/useFiltrosCatalogo';
import { ErrorBanner } from '../ui/ErrorBanner';

type Producto = { id: string; sku: string; nombre: string | null; categoria: string | null; subcategoria: string | null; tipo: string | null; stockDisponible: number };

type Lote = {
  id: string;
  numeroLote: string;
  proveedor: string | null;
  paisOrigen: string | null;
  ubicacionAlmacen: string | null;
  fechaVencimiento: string | null;
  cantidadRecibida: number;
  cantidadDanada: number;
  costoUnitarioReal: string | null;
  estado: string;
  motivoBloqueo: string | null;
};

type Breakdown = {
  fisico: number;
  bloqueado: number;
  danado: number;
  proximoVencer: number;
  vencido: number;
  reservadoTemporal: number;
  comprometido: number;
  disponible: number;
};

const ESTADOS_LOTE = [
  'NACIONALIZADO',
  'EN_TRASLADO_ALMACEN',
  'RECEPCION_PENDIENTE',
  'CONTROL_CALIDAD',
  'DISPONIBLE',
  'BLOQUEADO',
  'DANADO',
  'PROXIMO_VENCER',
  'VENCIDO',
  'EN_BAJA',
  'DADO_DE_BAJA',
];

const ETIQUETA_ESTADO: Record<string, string> = {
  NACIONALIZADO: 'Nacionalizado',
  EN_TRASLADO_ALMACEN: 'En traslado al almacén',
  RECEPCION_PENDIENTE: 'Recepción pendiente',
  CONTROL_CALIDAD: 'En control de calidad',
  DISPONIBLE: 'Disponible',
  BLOQUEADO: 'Bloqueado',
  DANADO: 'Dañado',
  PROXIMO_VENCER: 'Próximo a vencer',
  VENCIDO: 'Vencido',
  EN_BAJA: 'En proceso de baja',
  DADO_DE_BAJA: 'Dado de baja',
};

const COLOR_ESTADO: Record<string, string> = {
  DISPONIBLE: 'bg-musgo/20 text-musgo-dark',
  PROXIMO_VENCER: 'bg-promo/20 text-promo',
  VENCIDO: 'bg-red-100 text-red-700',
  BLOQUEADO: 'bg-red-100 text-red-700',
  DANADO: 'bg-red-100 text-red-700',
  DADO_DE_BAJA: 'bg-bosque/10 text-bosque/50',
};

export function InventarioSection() {
  const [lineas, setLineas] = useState<Producto[]>([]);
  const [seleccionado, setSeleccionado] = useState<Producto | null>(null);
  const [breakdown, setBreakdown] = useState<Breakdown | null>(null);
  const [lotes, setLotes] = useState<Lote[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);
  const [nuevoLote, setNuevoLote] = useState(false);

  async function cargarLineas() {
    setCargando(true);
    try {
      const data = await apiFetch<Producto[]>('/catalogo/admin/lineas');
      setLineas(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo cargar el catálogo.');
    } finally {
      setCargando(false);
    }
  }

  async function cargarDetalle(producto: Producto) {
    setSeleccionado(producto);
    setError(null);
    try {
      const [bd, ls] = await Promise.all([
        apiFetch<Breakdown>(`/inventario/stock/${producto.id}`),
        apiFetch<Lote[]>(`/inventario/lotes?catalogLineId=${producto.id}`),
      ]);
      setBreakdown(bd);
      setLotes(ls);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo cargar el inventario del producto.');
    }
  }

  useEffect(() => {
    cargarLineas();
  }, []);

  const { busqueda, setBusqueda, categoria, setCategoria, categorias, subcategoria, setSubcategoria, subcategorias, tipo, setTipo, tipos, filtrados } =
    useFiltrosCatalogo(lineas);

  if (seleccionado) {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <button onClick={() => setSeleccionado(null)} className="text-xs font-medium text-acento">← Volver al listado</button>
            <h2 className="mt-1 text-base font-medium text-bosque">{seleccionado.nombre ?? seleccionado.sku}</h2>
            <p className="text-xs text-bosque/50">{seleccionado.sku}</p>
          </div>
          <button onClick={() => setNuevoLote(true)} className="rounded-pill bg-bosque px-4 py-2 text-sm font-medium text-white">
            + Nuevo lote
          </button>
        </div>

        <ErrorBanner mensaje={error} />

        {breakdown && (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Stat label="Disponible" valor={breakdown.disponible} destacado />
            <Stat label="Físico" valor={breakdown.fisico} />
            <Stat label="Reservado" valor={breakdown.reservadoTemporal} />
            <Stat label="Comprometido" valor={breakdown.comprometido} />
            <Stat label="Próximo a vencer" valor={breakdown.proximoVencer} alerta={breakdown.proximoVencer > 0} />
            <Stat label="Vencido" valor={breakdown.vencido} alerta={breakdown.vencido > 0} />
            <Stat label="Bloqueado" valor={breakdown.bloqueado} alerta={breakdown.bloqueado > 0} />
            <Stat label="Dañado" valor={breakdown.danado} alerta={breakdown.danado > 0} />
          </div>
        )}

        <div className="overflow-x-auto rounded-card bg-white shadow-sm">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="border-b border-musgo/10 text-xs uppercase text-bosque/50">
                <th className="px-3 py-2 font-medium">Lote</th>
                <th className="px-3 py-2 font-medium">Vencimiento</th>
                <th className="px-3 py-2 font-medium">Recibida</th>
                <th className="px-3 py-2 font-medium">Dañada</th>
                <th className="px-3 py-2 font-medium">Ubicación</th>
                <th className="px-3 py-2 font-medium">Estado</th>
              </tr>
            </thead>
            <tbody>
              {lotes.map((l) => (
                <FilaLote key={l.id} lote={l} onCambiado={() => cargarDetalle(seleccionado)} />
              ))}
              {lotes.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-4 text-center text-xs text-bosque/50">Todavía no hay lotes cargados para este producto.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {nuevoLote && (
          <NuevoLoteModal
            catalogLineId={seleccionado.id}
            onClose={() => setNuevoLote(false)}
            onCreado={() => {
              setNuevoLote(false);
              cargarDetalle(seleccionado);
            }}
          />
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
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
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {filtrados.map((p) => (
          <button
            key={p.id}
            onClick={() => cargarDetalle(p)}
            className="flex items-center justify-between rounded-card bg-white p-3 text-left shadow-sm"
          >
            <div>
              <p className="text-sm font-medium">{p.nombre ?? p.sku}</p>
              <p className="text-xs text-bosque/50">{p.sku}</p>
            </div>
            <span className={`rounded-pill px-2 py-1 text-xs font-medium ${p.stockDisponible > 0 ? 'bg-musgo/20 text-musgo-dark' : 'bg-red-100 text-red-700'}`}>
              {p.stockDisponible} disp.
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

function Stat({ label, valor, destacado, alerta }: { label: string; valor: number; destacado?: boolean; alerta?: boolean }) {
  return (
    <div className={`rounded-card p-3 shadow-sm ${destacado ? 'bg-bosque text-white' : 'bg-white'}`}>
      <p className={`text-[11px] font-medium uppercase ${destacado ? 'text-white/70' : 'text-bosque/50'}`}>{label}</p>
      <p className={`mt-1 text-xl font-medium ${destacado ? 'text-white' : alerta ? 'text-red-600' : 'text-bosque'}`}>{valor}</p>
    </div>
  );
}

function FilaLote({ lote, onCambiado }: { lote: Lote; onCambiado: () => void }) {
  const [estado, setEstado] = useState(lote.estado);
  const [motivo, setMotivo] = useState(lote.motivoBloqueo ?? '');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cambio = estado !== lote.estado;

  async function guardar() {
    setError(null);
    setGuardando(true);
    try {
      await apiFetch(`/inventario/lotes/${lote.id}/estado`, { method: 'PATCH', body: { estado, motivo: estado === 'BLOQUEADO' ? motivo : undefined } });
      onCambiado();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo cambiar el estado.');
    } finally {
      setGuardando(false);
    }
  }

  return (
    <tr className="border-b border-musgo/10 align-top last:border-0">
      <td className="px-3 py-2 font-medium text-bosque">{lote.numeroLote}
        {lote.proveedor && <span className="block text-xs font-normal text-bosque/50">{lote.proveedor}{lote.paisOrigen ? ` · ${lote.paisOrigen}` : ''}</span>}
      </td>
      <td className="px-3 py-2 text-xs text-bosque/70">{lote.fechaVencimiento ? new Date(lote.fechaVencimiento).toLocaleDateString('es-PE') : '—'}</td>
      <td className="px-3 py-2 text-bosque/70">{lote.cantidadRecibida}</td>
      <td className="px-3 py-2 text-bosque/70">{lote.cantidadDanada}</td>
      <td className="px-3 py-2 text-xs text-bosque/70">{lote.ubicacionAlmacen ?? '—'}</td>
      <td className="px-3 py-2">
        <div className="flex flex-wrap items-center gap-1">
          <span className={`rounded-pill px-2 py-1 text-[11px] font-medium ${COLOR_ESTADO[lote.estado] ?? 'bg-crema text-bosque'}`}>
            {ETIQUETA_ESTADO[lote.estado]}
          </span>
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-1">
          <select value={estado} onChange={(e) => setEstado(e.target.value)} className="rounded-pill border border-musgo/30 px-2 py-1 text-[11px]">
            {ESTADOS_LOTE.map((e) => <option key={e} value={e}>{ETIQUETA_ESTADO[e]}</option>)}
          </select>
          {estado === 'BLOQUEADO' && (
            <input
              placeholder="Motivo del bloqueo"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              className="w-32 rounded-pill border border-musgo/30 px-2 py-1 text-[11px]"
            />
          )}
          {cambio && (
            <button onClick={guardar} disabled={guardando} className="rounded-pill bg-bosque px-2 py-1 text-[11px] font-medium text-white disabled:opacity-60">
              {guardando ? '...' : 'Guardar'}
            </button>
          )}
        </div>
        {error && <p className="mt-1 text-[11px] text-red-600">{error}</p>}
      </td>
    </tr>
  );
}

function NuevoLoteModal({ catalogLineId, onClose, onCreado }: { catalogLineId: string; onClose: () => void; onCreado: () => void }) {
  const [form, setForm] = useState({
    numeroLote: '',
    proveedor: '',
    paisOrigen: '',
    ubicacionAlmacen: '',
    fechaVencimiento: '',
    cantidadRecibida: '',
    cantidadDanada: '',
    costoUnitarioReal: '',
  });
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  function setCampo(campo: keyof typeof form, valor: string) {
    setForm((f) => ({ ...f, [campo]: valor }));
  }

  async function crear(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.numeroLote.trim()) {
      setError('El lote necesita un número.');
      return;
    }
    if (!form.cantidadRecibida) {
      setError('Ingresá la cantidad recibida.');
      return;
    }
    setGuardando(true);
    try {
      await apiFetch('/inventario/lotes', {
        method: 'POST',
        body: {
          catalogLineId,
          numeroLote: form.numeroLote.trim(),
          proveedor: form.proveedor || undefined,
          paisOrigen: form.paisOrigen || undefined,
          ubicacionAlmacen: form.ubicacionAlmacen || undefined,
          fechaVencimiento: form.fechaVencimiento ? new Date(form.fechaVencimiento).toISOString() : undefined,
          cantidadRecibida: Number(form.cantidadRecibida),
          cantidadDanada: form.cantidadDanada ? Number(form.cantidadDanada) : undefined,
          costoUnitarioReal: form.costoUnitarioReal ? Number(form.costoUnitarioReal) : undefined,
        },
      });
      onCreado();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo crear el lote.');
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center" onClick={onClose}>
      <form
        onSubmit={crear}
        className="w-full max-w-sm space-y-2 rounded-t-card bg-crema p-4 shadow-lg sm:rounded-card"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-bosque">Nuevo lote</p>
          <button type="button" aria-label="Cerrar" onClick={onClose} className="rounded-pill bg-white px-3 py-1 text-sm text-bosque shadow-sm">✕</button>
        </div>
        <p className="text-xs text-bosque/50">Nace en estado Nacionalizado — desde ahí lo avanzás hasta Disponible.</p>

        <input placeholder="N° de lote" value={form.numeroLote} onChange={(e) => setCampo('numeroLote', e.target.value)} className="w-full rounded-pill border border-musgo/30 bg-white px-3 py-2 text-sm" />
        <div className="grid grid-cols-2 gap-2">
          <input placeholder="Proveedor" value={form.proveedor} onChange={(e) => setCampo('proveedor', e.target.value)} className="rounded-pill border border-musgo/30 bg-white px-3 py-2 text-sm" />
          <input placeholder="País de origen" value={form.paisOrigen} onChange={(e) => setCampo('paisOrigen', e.target.value)} className="rounded-pill border border-musgo/30 bg-white px-3 py-2 text-sm" />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block px-1 text-[11px] text-bosque/50">Fecha de vencimiento</label>
            <input type="date" value={form.fechaVencimiento} onChange={(e) => setCampo('fechaVencimiento', e.target.value)} className="w-full rounded-pill border border-musgo/30 bg-white px-3 py-2 text-sm" />
          </div>
          <input placeholder="Ubicación en almacén" value={form.ubicacionAlmacen} onChange={(e) => setCampo('ubicacionAlmacen', e.target.value)} className="mt-4 rounded-pill border border-musgo/30 bg-white px-3 py-2 text-sm" />
        </div>
        <div className="grid grid-cols-3 gap-2">
          <input type="number" min={0} placeholder="Cant. recibida" value={form.cantidadRecibida} onChange={(e) => setCampo('cantidadRecibida', e.target.value)} className="rounded-pill border border-musgo/30 bg-white px-3 py-2 text-sm" />
          <input type="number" min={0} placeholder="Cant. dañada" value={form.cantidadDanada} onChange={(e) => setCampo('cantidadDanada', e.target.value)} className="rounded-pill border border-musgo/30 bg-white px-3 py-2 text-sm" />
          <input type="number" min={0} step="0.01" placeholder="Costo unit." value={form.costoUnitarioReal} onChange={(e) => setCampo('costoUnitarioReal', e.target.value)} className="rounded-pill border border-musgo/30 bg-white px-3 py-2 text-sm" />
        </div>

        <ErrorBanner mensaje={error} />

        <button type="submit" disabled={guardando} className="w-full rounded-pill bg-bosque py-2 text-sm font-medium text-white disabled:opacity-60">
          {guardando ? 'Creando…' : 'Crear lote'}
        </button>
      </form>
    </div>
  );
}
