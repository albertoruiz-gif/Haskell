'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { apiFetch, ApiError } from '../../lib/api';
import { saveSession, Usuario } from '../../lib/auth';
import { ErrorBanner } from '../../components/ui/ErrorBanner';

const ROLES_ADMIN = ['ADMINISTRADOR', 'GERENTE_COMERCIAL', 'GESTOR_CATALOGO'];

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const motivo = searchParams.get('motivo');
  const sesionVencida = motivo === 'sesion_vencida';
  const passwordCambiada = motivo === 'password_cambiada';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setCargando(true);
    try {
      const data = await apiFetch<{ accessToken: string; usuario: Usuario }>('/auth/login', {
        method: 'POST',
        body: { email, password },
      });
      saveSession(data);
      router.push(ROLES_ADMIN.includes(data.usuario.rol) ? '/gestion' : '/catalogo');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo iniciar sesión.');
    } finally {
      setCargando(false);
    }
  }

  return (
    <div className="flex min-h-[70vh] items-center justify-center">
      <form onSubmit={onSubmit} className="w-full max-w-sm space-y-3 rounded-card bg-white p-5 shadow-sm">
        <h1 className="text-lg font-medium text-bosque">Iniciar sesión</h1>

        {sesionVencida && (
          <p className="rounded-card bg-musgo/10 p-2 text-xs text-bosque/70">
            Tu sesión venció por seguridad — iniciá sesión de nuevo para seguir.
          </p>
        )}
        {passwordCambiada && (
          <p className="rounded-card bg-musgo/10 p-2 text-xs text-bosque/70">
            Contraseña actualizada. Iniciá sesión con tu contraseña nueva.
          </p>
        )}

        <div>
          <label className="text-xs font-medium uppercase text-bosque/60">Email</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded-pill border border-musgo/30 px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label className="text-xs font-medium uppercase text-bosque/60">Contraseña</label>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full rounded-pill border border-musgo/30 px-3 py-2 text-sm"
          />
        </div>

        <ErrorBanner mensaje={error} />

        <button
          type="submit"
          disabled={cargando}
          className="w-full rounded-pill bg-bosque py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {cargando ? 'Ingresando…' : 'Ingresar'}
        </button>

        <Link href="/recuperar-password" className="block text-center text-xs font-medium text-acento">
          ¿Olvidaste tu contraseña?
        </Link>
      </form>
    </div>
  );
}
