'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { apiFetch, ApiError } from '../../lib/api';
import { ErrorBanner } from '../../components/ui/ErrorBanner';

// Misma pantalla para activación de cuenta nueva y recuperación de clave
// olvidada — el backend no distingue el destino, solo valida el token
// (ver AuthService.generarYEnviarToken).
export default function RestablecerPasswordPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const [nuevaPassword, setNuevaPassword] = useState('');
  const [confirmar, setConfirmar] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);
  const [listo, setListo] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!token) {
      setError('El enlace no es válido — pedí uno nuevo desde "¿Olvidaste tu contraseña?".');
      return;
    }
    if (nuevaPassword.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres.');
      return;
    }
    if (nuevaPassword !== confirmar) {
      setError('Las contraseñas no coinciden.');
      return;
    }

    setCargando(true);
    try {
      await apiFetch('/auth/restablecer-password', { method: 'POST', body: { token, nuevaPassword } });
      setListo(true);
      setTimeout(() => router.push('/login'), 2500);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo actualizar la contraseña.');
    } finally {
      setCargando(false);
    }
  }

  return (
    <div className="flex min-h-[70vh] items-center justify-center">
      <div className="w-full space-y-3 rounded-card bg-white p-4 shadow-sm">
        <h1 className="text-lg font-medium text-bosque">Elegí tu contraseña</h1>

        {listo ? (
          <p className="rounded-card bg-musgo/10 p-3 text-sm text-bosque/80">
            Contraseña actualizada. Te llevamos al inicio de sesión…
          </p>
        ) : (
          <form onSubmit={onSubmit} className="space-y-3">
            {!token && (
              <p className="rounded-card bg-red-50 px-3 py-2 text-xs text-red-700">
                Este enlace no trae un token válido — abrilo desde el correo que te enviamos.
              </p>
            )}
            <div>
              <label className="text-xs font-medium uppercase text-bosque/60">Nueva contraseña</label>
              <input
                type="password"
                required
                minLength={8}
                value={nuevaPassword}
                onChange={(e) => setNuevaPassword(e.target.value)}
                className="mt-1 w-full rounded-pill border border-musgo/30 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-medium uppercase text-bosque/60">Confirmar contraseña</label>
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
              {cargando ? 'Guardando…' : 'Guardar contraseña'}
            </button>
          </form>
        )}

        <Link href="/login" className="block text-center text-xs font-medium text-acento">
          Volver a iniciar sesión
        </Link>
      </div>
    </div>
  );
}
