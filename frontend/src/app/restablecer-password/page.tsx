'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { apiFetch, ApiError } from '../../lib/api';
import { ErrorBanner } from '../../components/ui/ErrorBanner';

// Misma pantalla para activación de cuenta nueva y recuperación de clave
// olvidada — el backend no distingue el destino, solo valida el token
// (ver AuthService.generarYEnviarToken). Ojo con la copy: la confusión más
// común es que la gente busca una "clave anterior" que nunca existió —
// en altas nuevas la clave inicial es aleatoria y nadie la conoce, así que
// este formulario tiene que dejar clarísimo que se elige de cero acá mismo.
export default function RestablecerPasswordPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const [nuevaPassword, setNuevaPassword] = useState('');
  const [confirmar, setConfirmar] = useState('');
  const [verClave, setVerClave] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);
  const [listo, setListo] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (nuevaPassword.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres.');
      return;
    }
    if (nuevaPassword !== confirmar) {
      setError('Las contraseñas no coinciden — revisá que estén escritas igual en los dos campos.');
      return;
    }

    setCargando(true);
    try {
      await apiFetch('/auth/restablecer-password', { method: 'POST', body: { token, nuevaPassword } });
      setListo(true);
      setTimeout(() => router.push('/login'), 2500);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo actualizar la contraseña. Probá de nuevo.');
    } finally {
      setCargando(false);
    }
  }

  const tipoInput = verClave ? 'text' : 'password';

  return (
    <div className="flex min-h-[70vh] items-center justify-center">
      <div className="w-full max-w-sm space-y-3 rounded-card bg-white p-5 shadow-sm">
        <div>
          <h1 className="text-lg font-medium text-bosque">Elegí tu contraseña</h1>
          <p className="mt-1 text-xs text-bosque/60">
            No necesitás ninguna clave anterior — escribí acá la que vas a usar de ahora en adelante.
          </p>
        </div>

        {!token ? (
          <div className="space-y-3">
            <p className="rounded-card bg-red-50 px-3 py-2 text-xs text-red-700">
              Este enlace no trae la información necesaria para continuar. Abrilo directo desde el correo que
              recibiste, sin copiar solo una parte del link.
            </p>
            <Link
              href="/recuperar-password"
              className="block w-full rounded-pill bg-bosque py-2 text-center text-sm font-medium text-white"
            >
              Pedir un enlace nuevo
            </Link>
          </div>
        ) : listo ? (
          <div className="space-y-3">
            <p className="rounded-card bg-musgo/10 p-3 text-sm text-bosque/80">
              Contraseña guardada. Te llevamos al inicio de sesión…
            </p>
            <Link href="/login" className="block w-full rounded-pill bg-bosque py-2 text-center text-sm font-medium text-white">
              Ir a iniciar sesión ahora
            </Link>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="space-y-3">
            <div>
              <label className="text-xs font-medium uppercase text-bosque/60">Nueva contraseña</label>
              <input
                type={tipoInput}
                required
                minLength={8}
                autoFocus
                value={nuevaPassword}
                onChange={(e) => setNuevaPassword(e.target.value)}
                className="mt-1 w-full rounded-pill border border-musgo/30 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-medium uppercase text-bosque/60">Confirmar contraseña</label>
              <input
                type={tipoInput}
                required
                minLength={8}
                value={confirmar}
                onChange={(e) => setConfirmar(e.target.value)}
                className="mt-1 w-full rounded-pill border border-musgo/30 px-3 py-2 text-sm"
              />
            </div>

            <label className="flex items-center gap-2 text-xs text-bosque/60">
              <input type="checkbox" checked={verClave} onChange={(e) => setVerClave(e.target.checked)} />
              Mostrar las contraseñas
            </label>

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
