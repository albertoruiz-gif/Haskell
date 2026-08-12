'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch, ApiError } from '../../lib/api';
import { getUsuario, clearSession, Usuario } from '../../lib/auth';
import { ErrorBanner } from '../../components/ui/ErrorBanner';

export default function MiCuentaPage() {
  const router = useRouter();
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [passwordActual, setPasswordActual] = useState('');
  const [passwordNueva, setPasswordNueva] = useState('');
  const [confirmar, setConfirmar] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  useEffect(() => {
    setUsuario(getUsuario());
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (passwordNueva.length < 8) {
      setError('La contraseña nueva debe tener al menos 8 caracteres.');
      return;
    }
    if (passwordNueva !== confirmar) {
      setError('Las contraseñas nuevas no coinciden.');
      return;
    }

    setCargando(true);
    try {
      await apiFetch('/auth/mi-password', { method: 'PATCH', body: { passwordActual, passwordNueva } });
      // EP-01: cambiar la clave cierra la sesión actual del lado del
      // backend (a propósito, ver AuthService.cambiarPasswordPropia) — se
      // redirige de una vez en vez de dejar que la próxima llamada a la
      // API falle con un 401 que se sienta como un error random.
      clearSession();
      router.push('/login?motivo=password_cambiada');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo actualizar la contraseña.');
    } finally {
      setCargando(false);
    }
  }

  return (
    <div className="mx-auto max-w-md space-y-4">
      <div className="rounded-card bg-white p-4 shadow-sm">
        <h1 className="text-lg font-medium text-bosque">Mi cuenta</h1>
        {usuario && (
          <p className="mt-1 text-xs text-bosque/60">
            {usuario.nombre} · {usuario.rol}
          </p>
        )}
      </div>

      <form onSubmit={onSubmit} className="space-y-3 rounded-card bg-white p-4 shadow-sm">
        <h2 className="text-sm font-medium text-bosque">Cambiar contraseña</h2>

        <div>
          <label className="text-xs font-medium uppercase text-bosque/60">Contraseña actual</label>
          <input
            type="password"
            required
            value={passwordActual}
            onChange={(e) => setPasswordActual(e.target.value)}
            className="mt-1 w-full rounded-pill border border-musgo/30 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="text-xs font-medium uppercase text-bosque/60">Contraseña nueva</label>
          <input
            type="password"
            required
            minLength={8}
            value={passwordNueva}
            onChange={(e) => setPasswordNueva(e.target.value)}
            className="mt-1 w-full rounded-pill border border-musgo/30 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="text-xs font-medium uppercase text-bosque/60">Confirmar contraseña nueva</label>
          <input
            type="password"
            required
            minLength={8}
            value={confirmar}
            onChange={(e) => setConfirmar(e.target.value)}
            className="mt-1 w-full rounded-pill border border-musgo/30 px-3 py-2 text-sm"
          />
        </div>

        <ErrorBanner mensaje={error} />

        <button
          type="submit"
          disabled={cargando}
          className="w-full rounded-pill bg-bosque py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {cargando ? 'Guardando…' : 'Guardar cambios'}
        </button>
      </form>
    </div>
  );
}
