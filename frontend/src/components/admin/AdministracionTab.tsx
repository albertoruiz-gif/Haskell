'use client';

// Pestaña "Administración" de Gestión — EP-18: gestión de las cuentas
// administrativas (ADMINISTRADOR/GERENTE_GENERAL/GERENTE_COMERCIAL/
// FINANZAS), las únicas que usan 2FA. Solo visible/accesible para
// ADMINISTRADOR (ver gestion/page.tsx) — el backend también lo exige,
// esto es nada más para no mostrar un botón que va a fallar.

import { useEffect, useState } from 'react';
import { apiFetch, ApiError } from '../../lib/api';
import { ErrorBanner } from '../ui/ErrorBanner';

const ROLES = [
  { value: 'ADMINISTRADOR', label: 'Administrador' },
  { value: 'GERENTE_GENERAL', label: 'Gerente General' },
  { value: 'GERENTE_COMERCIAL', label: 'Gerente Comercial' },
  { value: 'FINANZAS', label: 'Finanzas' },
];

type UsuarioAdmin = {
  id: string;
  nombre: string;
  email: string;
  rol: string;
  activo: boolean;
  totpActivadoEn: string | null;
};

const FORM_INICIAL = { email: '', nombre: '', rol: ROLES[0].value };

export function AdministracionTab() {
  const [usuarios, setUsuarios] = useState<UsuarioAdmin[]>([]);
  const [form, setForm] = useState(FORM_INICIAL);
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [accionEnCursoId, setAccionEnCursoId] = useState<string | null>(null);

  async function cargar() {
    try {
      const data = await apiFetch<UsuarioAdmin[]>('/auth/usuarios-administrativos');
      setUsuarios(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudieron cargar las cuentas.');
    }
  }

  useEffect(() => {
    cargar();
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setGuardando(true);
    try {
      await apiFetch('/auth/usuarios-administrativos', { method: 'POST', body: form });
      setForm(FORM_INICIAL);
      await cargar();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo crear la cuenta.');
    } finally {
      setGuardando(false);
    }
  }

  async function accion(userId: string, path: string, mensajeError: string) {
    setError(null);
    setAccionEnCursoId(userId);
    try {
      await apiFetch(`/auth/usuarios/${userId}/${path}`, { method: 'PATCH' });
      await cargar();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : mensajeError);
    } finally {
      setAccionEnCursoId(null);
    }
  }

  return (
    <div className="space-y-3 lg:grid lg:grid-cols-[360px_1fr] lg:items-start lg:gap-4 lg:space-y-0">
      <form onSubmit={onSubmit} className="space-y-2 rounded-card bg-white p-3 shadow-sm">
        <p className="text-sm font-medium text-bosque">Nueva cuenta administrativa</p>
        <p className="text-xs text-bosque/60">
          Se le envía un correo de activación para que elija su contraseña. Su plazo de gracia de 2FA (7 días) arranca
          desde ahora.
        </p>

        <input
          type="email"
          required
          placeholder="Email"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          className="w-full rounded-pill border border-musgo/30 px-3 py-2 text-sm"
        />
        <input
          type="text"
          required
          placeholder="Nombre completo"
          value={form.nombre}
          onChange={(e) => setForm({ ...form, nombre: e.target.value })}
          className="w-full rounded-pill border border-musgo/30 px-3 py-2 text-sm"
        />
        <select
          value={form.rol}
          onChange={(e) => setForm({ ...form, rol: e.target.value })}
          className="w-full rounded-pill border border-musgo/30 px-3 py-2 text-sm"
        >
          {ROLES.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>

        <ErrorBanner mensaje={error} />

        <button
          type="submit"
          disabled={guardando}
          className="w-full rounded-pill bg-bosque py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {guardando ? 'Creando…' : 'Crear cuenta'}
        </button>
      </form>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {usuarios.map((u) => (
          <div key={u.id} className="rounded-card bg-white p-3 shadow-sm">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-sm font-medium text-bosque">{u.nombre}</p>
                <p className="text-xs text-bosque/60">{u.email}</p>
                <p className="text-xs text-bosque/50">{ROLES.find((r) => r.value === u.rol)?.label ?? u.rol}</p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <span className={`rounded-pill px-2 py-0.5 text-[11px] font-medium ${u.activo ? 'bg-bosque text-white' : 'bg-red-100 text-red-700'}`}>
                  {u.activo ? 'Activo' : 'Inactivo'}
                </span>
                <span className={`rounded-pill px-2 py-0.5 text-[11px] font-medium ${u.totpActivadoEn ? 'bg-musgo/20 text-musgo-dark' : 'bg-promo/15 text-promo'}`}>
                  {u.totpActivadoEn ? '2FA activo' : '2FA sin configurar'}
                </span>
              </div>
            </div>

            <div className="mt-2 grid grid-cols-2 gap-1.5">
              <button
                disabled={accionEnCursoId === u.id}
                onClick={() => accion(u.id, u.activo ? 'desactivar' : 'reactivar', 'No se pudo actualizar el estado.')}
                className="rounded-pill bg-crema py-1.5 text-[11px] font-medium text-acento disabled:opacity-50"
              >
                {u.activo ? 'Desactivar' : 'Reactivar'}
              </button>
              <button
                disabled={accionEnCursoId === u.id || !u.activo}
                onClick={() => accion(u.id, 'cerrar-sesiones', 'No se pudo cerrar la sesión.')}
                title="Cierra su sesión actual sin desactivar la cuenta."
                className="rounded-pill bg-crema py-1.5 text-[11px] font-medium text-bosque disabled:opacity-50"
              >
                Cerrar sesión
              </button>
              <button
                disabled={accionEnCursoId === u.id || !u.totpActivadoEn}
                onClick={() => accion(u.id, 'resetear-2fa', 'No se pudo resetear el 2FA.')}
                title="Para cuando perdió el celular/app autenticadora — en su próximo login tiene que reconfigurarlo."
                className="col-span-2 rounded-pill bg-crema py-1.5 text-[11px] font-medium text-bosque disabled:opacity-50"
              >
                Resetear 2FA
              </button>
            </div>
          </div>
        ))}
        {usuarios.length === 0 && <p className="text-xs text-bosque/50">Todavía no hay cuentas administrativas.</p>}
      </div>
    </div>
  );
}
