'use client';

// EP-18: flujo de configuración de 2FA (QR + código de confirmación),
// compartido entre dos contextos: activación voluntaria desde Mi cuenta
// (con sesión completa, sin pasar `tokenTemporal`) y activación forzada
// justo después del login cuando venció el plazo de gracia (con el
// `tokenTemporal` de scope 'setup_2fa' que devolvió /auth/login).

import { useState } from 'react';
import { apiFetch, ApiError } from '../../lib/api';
import { ErrorBanner } from '../ui/ErrorBanner';
import type { Usuario } from '../../lib/auth';

type ResultadoActivacion = { accessToken: string; usuario: Usuario };

export function Configurar2FA({
  tokenTemporal,
  onActivado,
}: {
  tokenTemporal?: string;
  onActivado: (resultado: ResultadoActivacion) => void;
}) {
  const [paso, setPaso] = useState<'inicio' | 'codigo'>('inicio');
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [secreto, setSecreto] = useState('');
  const [codigo, setCodigo] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  async function generar() {
    setError(null);
    setCargando(true);
    try {
      const data = await apiFetch<{ secreto: string; qrDataUrl: string }>('/auth/2fa/generar', {
        method: 'POST',
        token: tokenTemporal,
      });
      setQrDataUrl(data.qrDataUrl);
      setSecreto(data.secreto);
      setPaso('codigo');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo generar el código.');
    } finally {
      setCargando(false);
    }
  }

  async function activar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setCargando(true);
    try {
      const data = await apiFetch<ResultadoActivacion>('/auth/2fa/activar', {
        method: 'POST',
        body: { codigo },
        token: tokenTemporal,
        manejar401: false, // un código incorrecto no es "sesión vencida"
      });
      onActivado(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo activar. Probá de nuevo.');
    } finally {
      setCargando(false);
    }
  }

  if (paso === 'inicio') {
    return (
      <div className="space-y-3">
        <p className="text-sm text-bosque/70">
          Escaneá el código QR con una app autenticadora (Google Authenticator, Authy, o similar).
        </p>
        <ErrorBanner mensaje={error} />
        <button
          onClick={generar}
          disabled={cargando}
          className="w-full rounded-pill bg-bosque py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {cargando ? 'Generando…' : 'Generar código QR'}
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={activar} className="space-y-3">
      {/* eslint-disable-next-line @next/next/no-img-element -- data URI generada por el backend, no un asset optimizable */}
      <img src={qrDataUrl} alt="Código QR para configurar 2FA" className="mx-auto h-48 w-48" />
      <p className="text-center text-xs text-bosque/60">
        ¿No podés escanearlo? Escribilo a mano en tu app: <br />
        <code className="mt-1 inline-block rounded-card bg-crema px-2 py-1 text-[11px] tracking-wider">{secreto}</code>
      </p>

      <div>
        <label className="text-xs font-medium uppercase text-bosque/60">Código de 6 dígitos</label>
        <input
          type="text"
          inputMode="numeric"
          pattern="[0-9]{6}"
          maxLength={6}
          required
          value={codigo}
          onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ''))}
          className="mt-1 w-full rounded-pill border border-musgo/30 px-3 py-2 text-center text-lg tracking-[0.3em]"
          autoFocus
        />
      </div>

      <ErrorBanner mensaje={error} />

      <button
        type="submit"
        disabled={cargando || codigo.length !== 6}
        className="w-full rounded-pill bg-bosque py-2 text-sm font-medium text-white disabled:opacity-60"
      >
        {cargando ? 'Confirmando…' : 'Activar 2FA'}
      </button>
    </form>
  );
}
