import { getToken, clearSession } from './auth';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3002/api';
// Los archivos subidos (fotos de producto) se sirven fuera del prefijo /api
// (ver backend/src/main.ts, useStaticAssets no respeta setGlobalPrefix).
const ASSET_BASE_URL = API_URL.replace(/\/api\/?$/, '');

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

type ApiFetchOptions = {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  isFormData?: boolean;
  // EP-18: los pasos de 2FA durante el login (generar QR, activar, verificar
  // código) usan el tokenTemporal que devuelve /auth/login — todavía no hay
  // una sesión completa guardada en localStorage para esos casos.
  token?: string;
  // Un 401 ahí es "código incorrecto", no "sesión vencida" — no corresponde
  // que la app te mande de vuelta al login solo, el propio flujo lo maneja.
  manejar401?: boolean;
};

export async function apiFetch<T>(path: string, opts: ApiFetchOptions = {}): Promise<T> {
  const headers: Record<string, string> = {};
  const token = opts.token ?? getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  let body: BodyInit | undefined;
  if (opts.body !== undefined) {
    if (opts.isFormData) {
      body = opts.body as FormData; // el navegador setea Content-Type con el boundary
    } else {
      headers['Content-Type'] = 'application/json';
      body = JSON.stringify(opts.body);
    }
  }

  const res = await fetch(`${API_URL}${path}`, { method: opts.method ?? 'GET', headers, body });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    // El token JWT vence a las 8h (RNF-007). Sin esto, cada pantalla que
    // llama a la API mostraba el texto crudo "Unauthorized" en vez de
    // llevar de nuevo al login — la sesión vencida parecía una pantalla rota.
    if (res.status === 401 && opts.manejar401 !== false && typeof window !== 'undefined') {
      clearSession();
      if (window.location.pathname !== '/login') {
        window.location.href = '/login?motivo=sesion_vencida';
      }
    }
    throw new ApiError(data.message ?? `Error ${res.status}`, res.status);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export function resolveAssetUrl(path?: string | null): string | undefined {
  if (!path) return undefined;
  return `${ASSET_BASE_URL}${path}`;
}
