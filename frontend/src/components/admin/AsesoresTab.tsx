'use client';

import { useEffect, useState } from 'react';
import { apiFetch, ApiError } from '../../lib/api';
import { ErrorBanner } from '../ui/ErrorBanner';

const CANALES = ['SALONES_BELLEZA', 'RETAIL', 'COMERCIO_MINORISTA'];

type Asesor = {
  id: string;
  apellidos: string;
  numeroDocumento: string;
  telefonoPrincipal: string;
  canal: string;
  user: { id: string; email: string; nombre: string; activo: boolean };
  direcciones: { distrito: string; departamento: string; provincia: string; pais: string }[];
  lider: { id: string; user: { nombre: string } } | null;
};

type Lider = { id: string; user: { nombre: string; activo: boolean } };

// EP-02: quién cambió a quién de líder y cuándo — antes Asesor.liderId solo
// guardaba el estado actual, sin rastro de reasignaciones previas.
type HistorialItem = {
  id: string;
  liderAnterior: string | null;
  liderNuevo: string | null;
  actor: string;
  motivo: string | null;
  createdAt: string;
};

const FORM_INICIAL = {
  email: '',
  nombres: '',
  apellidos: '',
  tipoDocumento: 'DNI',
  numeroDocumento: '',
  fechaNacimiento: '',
  telefonoPrincipal: '',
  numeroYape: '',
  canal: CANALES[0],
  departamento: '',
  provincia: '',
  distrito: '',
  direccion: '',
  pais: 'Perú',
};

export function AsesoresTab() {
  const [asesores, setAsesores] = useState<Asesor[]>([]);
  const [lideres, setLideres] = useState<Lider[]>([]);
  const [form, setForm] = useState(FORM_INICIAL);
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  async function cargar() {
    try {
      const data = await apiFetch<Asesor[]>('/afiliacion');
      setAsesores(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo cargar la lista de asesores.');
    }
  }

  // Solo se usa para armar el selector de reasignación (EP-02) — un asesor
  // sin líderes cargados igual puede verse en la lista, solo no puede
  // reasignarse hasta que exista al menos uno.
  async function cargarLideres() {
    try {
      const data = await apiFetch<Lider[]>('/lideres');
      setLideres(data.filter((l) => l.user.activo));
    } catch {
      // No bloquea la pantalla — solo no aparece el selector de reasignación.
    }
  }

  useEffect(() => {
    cargar();
    cargarLideres();
  }, []);

  function setCampo(campo: keyof typeof FORM_INICIAL, valor: string) {
    setForm((f) => ({ ...f, [campo]: valor }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setGuardando(true);
    try {
      await apiFetch('/afiliacion/individual', {
        method: 'POST',
        body: {
          email: form.email,
          nombres: form.nombres,
          apellidos: form.apellidos,
          tipoDocumento: form.tipoDocumento,
          numeroDocumento: form.numeroDocumento,
          fechaNacimiento: form.fechaNacimiento,
          telefonoPrincipal: form.telefonoPrincipal,
          numeroYape: form.numeroYape,
          canal: form.canal,
          direccion: {
            departamento: form.departamento,
            provincia: form.provincia,
            distrito: form.distrito,
            direccion: form.direccion,
            pais: form.pais,
          },
        },
      });
      setForm(FORM_INICIAL);
      await cargar();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo crear el asesor.');
    } finally {
      setGuardando(false);
    }
  }

  async function toggleActivo(userId: string, activo: boolean) {
    setError(null);
    try {
      await apiFetch(`/auth/usuarios/${userId}/${activo ? 'desactivar' : 'reactivar'}`, { method: 'PATCH' });
      await cargar();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo actualizar el estado.');
    }
  }

  // EP-01: cerrar la sesión sin desactivar la cuenta — para "perdí el
  // celular" o sospecha de acceso indebido, cuando la persona sigue
  // trabajando pero necesita volver a loguearse.
  const [cerrandoId, setCerrandoId] = useState<string | null>(null);
  async function cerrarSesiones(userId: string) {
    setError(null);
    try {
      await apiFetch(`/auth/usuarios/${userId}/cerrar-sesiones`, { method: 'PATCH' });
      setCerrandoId(userId);
      setTimeout(() => setCerrandoId(null), 2000);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo cerrar la sesión.');
    }
  }

  // EP-02: reasignar líder + ver historial de reasignaciones — solo aplica
  // a asesores de Comercio Minorista (los únicos con líder asignado).
  const [nuevoLiderPorAsesor, setNuevoLiderPorAsesor] = useState<Record<string, string>>({});
  const [motivoPorAsesor, setMotivoPorAsesor] = useState<Record<string, string>>({});
  const [reasignandoId, setReasignandoId] = useState<string | null>(null);
  const [historialAbiertoId, setHistorialAbiertoId] = useState<string | null>(null);
  const [historialPorAsesor, setHistorialPorAsesor] = useState<Record<string, HistorialItem[]>>({});
  const [cargandoHistorial, setCargandoHistorial] = useState(false);

  async function reasignarLider(asesorId: string) {
    const liderId = nuevoLiderPorAsesor[asesorId];
    if (!liderId) return;
    setError(null);
    setReasignandoId(asesorId);
    try {
      await apiFetch(`/afiliacion/${asesorId}/lider`, {
        method: 'PATCH',
        body: { liderId, motivo: motivoPorAsesor[asesorId] || undefined },
      });
      setNuevoLiderPorAsesor((s) => ({ ...s, [asesorId]: '' }));
      setMotivoPorAsesor((s) => ({ ...s, [asesorId]: '' }));
      await cargar();
      if (historialAbiertoId === asesorId) await toggleHistorial(asesorId, true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo reasignar el líder.');
    } finally {
      setReasignandoId(null);
    }
  }

  async function toggleHistorial(asesorId: string, forzarRecarga = false) {
    if (historialAbiertoId === asesorId && !forzarRecarga) {
      setHistorialAbiertoId(null);
      return;
    }
    setHistorialAbiertoId(asesorId);
    setCargandoHistorial(true);
    try {
      const data = await apiFetch<HistorialItem[]>(`/afiliacion/${asesorId}/historial-asignaciones`);
      setHistorialPorAsesor((h) => ({ ...h, [asesorId]: data }));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo cargar el historial.');
    } finally {
      setCargandoHistorial(false);
    }
  }

  return (
    <div className="space-y-3 lg:grid lg:grid-cols-[360px_1fr] lg:items-start lg:gap-4 lg:space-y-0">
      <form onSubmit={onSubmit} className="space-y-2 rounded-card bg-white p-3 shadow-sm">
        <p className="text-sm font-medium text-bosque">Nuevo asesor</p>
        <div className="grid grid-cols-2 gap-2">
          <input required placeholder="Nombre" value={form.nombres} onChange={(e) => setCampo('nombres', e.target.value)} className="rounded-pill border border-musgo/30 px-3 py-2 text-sm" />
          <input required placeholder="Apellidos" value={form.apellidos} onChange={(e) => setCampo('apellidos', e.target.value)} className="rounded-pill border border-musgo/30 px-3 py-2 text-sm" />
          <input required type="email" placeholder="Email" value={form.email} onChange={(e) => setCampo('email', e.target.value)} className="col-span-2 rounded-pill border border-musgo/30 px-3 py-2 text-sm" />
          <input required placeholder="Teléfono" value={form.telefonoPrincipal} onChange={(e) => setCampo('telefonoPrincipal', e.target.value)} className="rounded-pill border border-musgo/30 px-3 py-2 text-sm" />
          <input required type="date" placeholder="Fecha de nacimiento" value={form.fechaNacimiento} onChange={(e) => setCampo('fechaNacimiento', e.target.value)} className="rounded-pill border border-musgo/30 px-3 py-2 text-sm" />
          <input required placeholder="DNI" value={form.numeroDocumento} onChange={(e) => setCampo('numeroDocumento', e.target.value)} className="rounded-pill border border-musgo/30 px-3 py-2 text-sm" />
          <input required placeholder="Número Yape" value={form.numeroYape} onChange={(e) => setCampo('numeroYape', e.target.value)} className="rounded-pill border border-musgo/30 px-3 py-2 text-sm" />
          <input required placeholder="Dirección" value={form.direccion} onChange={(e) => setCampo('direccion', e.target.value)} className="col-span-2 rounded-pill border border-musgo/30 px-3 py-2 text-sm" />
          <input required placeholder="Distrito" value={form.distrito} onChange={(e) => setCampo('distrito', e.target.value)} className="rounded-pill border border-musgo/30 px-3 py-2 text-sm" />
          <input required placeholder="Provincia" value={form.provincia} onChange={(e) => setCampo('provincia', e.target.value)} className="rounded-pill border border-musgo/30 px-3 py-2 text-sm" />
          <input required placeholder="Departamento" value={form.departamento} onChange={(e) => setCampo('departamento', e.target.value)} className="rounded-pill border border-musgo/30 px-3 py-2 text-sm" />
          <input required placeholder="País" value={form.pais} onChange={(e) => setCampo('pais', e.target.value)} className="rounded-pill border border-musgo/30 px-3 py-2 text-sm" />
          <select value={form.canal} onChange={(e) => setCampo('canal', e.target.value)} className="col-span-2 rounded-pill border border-musgo/30 px-3 py-2 text-sm">
            {CANALES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
        <ErrorBanner mensaje={error} />
        <button type="submit" disabled={guardando} className="w-full rounded-pill bg-bosque py-2 text-sm font-medium text-white disabled:opacity-60">
          {guardando ? 'Guardando…' : 'Crear asesor'}
        </button>
      </form>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {asesores.map((a) => (
          <div key={a.id} className="rounded-card bg-white p-3 shadow-sm">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium">{a.user.nombre}</p>
                <p className="text-xs text-bosque/60">{a.user.email} · {a.numeroDocumento} · {a.canal}</p>
                {a.direcciones[0] && (
                  <p className="text-xs text-bosque/50">{a.direcciones[0].distrito}, {a.direcciones[0].provincia}, {a.direcciones[0].pais}</p>
                )}
              </div>
              <span className={`rounded-pill px-3 py-1 text-xs font-medium ${a.user.activo ? 'bg-bosque text-white' : 'bg-red-100 text-red-700'}`}>
                {a.user.activo ? 'Activo' : 'Inactivo'}
              </span>
            </div>
            <div className="mt-2 flex gap-2">
              <button
                onClick={() => toggleActivo(a.user.id, a.user.activo)}
                className="flex-1 rounded-pill bg-crema py-2 text-xs font-medium text-acento"
              >
                {a.user.activo ? 'Desactivar' : 'Reactivar'}
              </button>
              {a.user.activo && (
                <button
                  onClick={() => cerrarSesiones(a.user.id)}
                  title="Cierra su sesión actual sin desactivar la cuenta — vuelve a pedir login."
                  className="flex-1 rounded-pill bg-crema py-2 text-xs font-medium text-bosque"
                >
                  {cerrandoId === a.user.id ? '✓ Sesión cerrada' : 'Cerrar sesión'}
                </button>
              )}
            </div>

            {/* EP-02: reasignar líder + ver historial — solo Comercio Minorista tiene líder. */}
            {a.canal === 'COMERCIO_MINORISTA' && (
              <div className="mt-2 border-t border-musgo/10 pt-2">
                <p className="text-xs text-bosque/60">
                  Líder actual: <span className="font-medium text-bosque">{a.lider?.user.nombre ?? 'Sin líder'}</span>
                </p>
                <div className="mt-1 flex flex-wrap gap-1">
                  <select
                    value={nuevoLiderPorAsesor[a.id] ?? ''}
                    onChange={(e) => setNuevoLiderPorAsesor((s) => ({ ...s, [a.id]: e.target.value }))}
                    className="flex-1 rounded-pill border border-musgo/30 px-2 py-1 text-xs"
                  >
                    <option value="">Reasignar a…</option>
                    {lideres.filter((l) => l.id !== a.lider?.id).map((l) => (
                      <option key={l.id} value={l.id}>{l.user.nombre}</option>
                    ))}
                  </select>
                  <button
                    onClick={() => reasignarLider(a.id)}
                    disabled={!nuevoLiderPorAsesor[a.id] || reasignandoId === a.id}
                    className="rounded-pill bg-crema px-2 py-1 text-xs font-medium text-acento disabled:opacity-40"
                  >
                    {reasignandoId === a.id ? '…' : 'Reasignar'}
                  </button>
                </div>
                <input
                  placeholder="Motivo (opcional)"
                  value={motivoPorAsesor[a.id] ?? ''}
                  onChange={(e) => setMotivoPorAsesor((s) => ({ ...s, [a.id]: e.target.value }))}
                  className="mt-1 w-full rounded-pill border border-musgo/30 px-2 py-1 text-xs"
                />
                <button onClick={() => toggleHistorial(a.id)} className="mt-1 text-[11px] text-bosque/50 underline">
                  {historialAbiertoId === a.id ? 'Ocultar historial' : 'Ver historial de reasignaciones'}
                </button>
                {historialAbiertoId === a.id && (
                  <div className="mt-1 space-y-1 rounded-lg bg-crema/50 p-2 text-[11px] text-bosque/70">
                    {cargandoHistorial && <p>Cargando…</p>}
                    {!cargandoHistorial && (historialPorAsesor[a.id]?.length ?? 0) === 0 && <p>Sin cambios registrados.</p>}
                    {!cargandoHistorial && historialPorAsesor[a.id]?.map((h) => (
                      <p key={h.id}>
                        {new Date(h.createdAt).toLocaleDateString('es-PE')} — {h.liderAnterior ?? 'sin líder'} → {h.liderNuevo ?? 'sin líder'} (por {h.actor}
                        {h.motivo ? `, motivo: ${h.motivo}` : ''})
                      </p>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
        {asesores.length === 0 && <p className="text-xs text-bosque/50">Todavía no hay asesores.</p>}
      </div>
    </div>
  );
}
