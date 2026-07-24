'use client';

import { useEffect, useState } from 'react';
import { apiFetch, ApiError } from '../../lib/api';

const CANALES = ['SALONES_BELLEZA', 'RETAIL', 'COMERCIO_MINORISTA'];

type Asesor = {
  id: string;
  apellidos: string;
  numeroDocumento: string;
  telefonoPrincipal: string;
  canal: string;
  user: { id: string; email: string; nombre: string; activo: boolean };
  direcciones: { distrito: string; departamento: string; provincia: string; pais: string }[];
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

  useEffect(() => {
    cargar();
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

  return (
    <div className="space-y-3">
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
        {error && <p className="text-xs text-red-600">{error}</p>}
        <button type="submit" disabled={guardando} className="w-full rounded-pill bg-bosque py-2 text-sm font-medium text-white disabled:opacity-60">
          {guardando ? 'Guardando…' : 'Crear asesor'}
        </button>
      </form>

      <div className="space-y-2">
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
            <button
              onClick={() => toggleActivo(a.user.id, a.user.activo)}
              className="mt-2 w-full rounded-pill bg-crema py-2 text-xs font-medium text-acento"
            >
              {a.user.activo ? 'Desactivar' : 'Reactivar'}
            </button>
          </div>
        ))}
        {asesores.length === 0 && <p className="text-xs text-bosque/50">Todavía no hay asesores.</p>}
      </div>
    </div>
  );
}
