'use client';

import { useState } from 'react';
import Link from 'next/link';
import { apiFetch, ApiError } from '../../lib/api';
import { ErrorBanner } from '../../components/ui/ErrorBanner';

// RF-001: la respuesta del backend es siempre genérica (no revela si el
// correo existe), así que acá tampoco distinguimos "no existe" de "sí
// existe" — el mensaje de éxito es el mismo en ambos casos.
export default function RecuperarPasswordPage() {
  const [email, setEmail] = useState('');
  const [enviado, setEnviado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setCargando(true);
    try {
      await apiFetch('/auth/olvide-password', { method: 'POST', body: { email } });
      setEnviado(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo procesar la solicitud.');
    } finally {
      setCargando(false);
    }
  }

  return (
    <div className="flex min-h-[70vh] items-center justify-center">
      <div className="w-full max-w-sm space-y-3 rounded-card bg-white p-5 shadow-sm">
        <h1 className="text-lg font-medium text-bosque">Recuperar contraseña</h1>

        {enviado ? (
          <p className="rounded-card bg-musgo/10 p-3 text-sm text-bosque/80">
            Si el correo <strong>{email}</strong> está registrado, te enviamos un enlace para elegir una nueva
            contraseña. Revisá tu bandeja de entrada (y spam) — el enlace expira en 30 minutos.
          </p>
        ) : (
          <form onSubmit={onSubmit} className="space-y-3">
            <p className="text-xs text-bosque/60">
              Ingresá el correo con el que te registraste — te enviamos un enlace para elegir una nueva contraseña.
            </p>
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

            <ErrorBanner mensaje={error} />

            <button
              type="submit"
              disabled={cargando}
              className="w-full rounded-pill bg-bosque py-2 text-sm font-medium text-white disabled:opacity-60"
            >
              {cargando ? 'Enviando…' : 'Enviar enlace'}
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
