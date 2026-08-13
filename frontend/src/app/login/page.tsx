'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { apiFetch, ApiError } from '../../lib/api';
import { saveSession, setAviso2FA, Usuario } from '../../lib/auth';
import { ErrorBanner } from '../../components/ui/ErrorBanner';
import { Configurar2FA } from '../../components/auth/Configurar2FA';

const ROLES_ADMIN = ['ADMINISTRADOR', 'GERENTE_COMERCIAL', 'GESTOR_CATALOGO'];

// Respuesta de POST /auth/login — tres formas posibles (ver AuthService.login, EP-18):
// 1) login normal: { accessToken, usuario, debeConfigurar2fa?, graciaHasta? }
// 2) ya tiene 2FA activo, falta el código: { requiere2fa: true, tokenTemporal, nombre }
// 3) 2FA obligatorio y venció el plazo de gracia: { debeConfigurarAhora: true, tokenTemporal, nombre }
type RespuestaLogin =
  | { accessToken: string; usuario: Usuario; debeConfigurar2fa?: boolean; graciaHasta?: string }
  | { requiere2fa: true; tokenTemporal: string; nombre: string }
  | { debeConfigurarAhora: true; tokenTemporal: string; nombre: string };

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

  // EP-18: estado del segundo paso (código ya activo) o del paso de
  // configuración forzada (sin 2FA todavía, venció la gracia).
  const [paso, setPaso] = useState<'credenciales' | 'codigo2fa' | 'configurar2fa'>('credenciales');
  const [tokenTemporal, setTokenTemporal] = useState('');
  const [nombreTemp, setNombreTemp] = useState('');
  const [codigo, setCodigo] = useState('');

  function completarLogin(data: { accessToken: string; usuario: Usuario }) {
    saveSession(data);
    router.push(ROLES_ADMIN.includes(data.usuario.rol) ? '/gestion' : '/catalogo');
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setCargando(true);
    try {
      const data = await apiFetch<RespuestaLogin>('/auth/login', { method: 'POST', body: { email, password } });
      if ('requiere2fa' in data) {
        setTokenTemporal(data.tokenTemporal);
        setNombreTemp(data.nombre);
        setPaso('codigo2fa');
      } else if ('debeConfigurarAhora' in data) {
        setTokenTemporal(data.tokenTemporal);
        setNombreTemp(data.nombre);
        setPaso('configurar2fa');
      } else {
        if (data.debeConfigurar2fa && data.graciaHasta) setAviso2FA(data.graciaHasta);
        completarLogin(data);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo iniciar sesión.');
    } finally {
      setCargando(false);
    }
  }

  async function onVerificarCodigo(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setCargando(true);
    try {
      const data = await apiFetch<{ accessToken: string; usuario: Usuario }>('/auth/2fa/verificar-login', {
        method: 'POST',
        body: { codigo },
        token: tokenTemporal,
        manejar401: false, // un código incorrecto no es "sesión vencida"
      });
      completarLogin(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo verificar el código.');
    } finally {
      setCargando(false);
    }
  }

  if (paso === 'configurar2fa') {
    return (
      <div className="flex min-h-[70vh] items-center justify-center">
        <div className="w-full max-w-sm space-y-3 rounded-card bg-white p-5 shadow-sm">
          <h1 className="text-lg font-medium text-bosque">Configurá tu segundo factor</h1>
          <p className="text-xs text-bosque/60">
            Hola {nombreTemp} — por seguridad, tu rol requiere verificación en dos pasos. Configurala ahora para poder
            continuar.
          </p>
          <Configurar2FA tokenTemporal={tokenTemporal} onActivado={completarLogin} />
        </div>
      </div>
    );
  }

  if (paso === 'codigo2fa') {
    return (
      <div className="flex min-h-[70vh] items-center justify-center">
        <form onSubmit={onVerificarCodigo} className="w-full max-w-sm space-y-3 rounded-card bg-white p-5 shadow-sm">
          <h1 className="text-lg font-medium text-bosque">Verificación en dos pasos</h1>
          <p className="text-xs text-bosque/60">Hola {nombreTemp} — ingresá el código de tu app autenticadora.</p>

          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]{6}"
            maxLength={6}
            required
            value={codigo}
            onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ''))}
            className="w-full rounded-pill border border-musgo/30 px-3 py-2 text-center text-lg tracking-[0.3em]"
            autoFocus
          />

          <ErrorBanner mensaje={error} />

          <button
            type="submit"
            disabled={cargando || codigo.length !== 6}
            className="w-full rounded-pill bg-bosque py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            {cargando ? 'Verificando…' : 'Ingresar'}
          </button>
        </form>
      </div>
    );
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

        <p className="text-center text-xs text-bosque/60">
          <Link href="/recuperar-password" className="font-medium text-acento">
            ¿Olvidaste tu contraseña?
          </Link>
        </p>
      </form>
    </div>
  );
}
