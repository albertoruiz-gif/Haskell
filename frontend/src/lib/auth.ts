const STORAGE_KEY = 'haskell.sesion';
// EP-18: separado de la sesión — cuándo vence el plazo de gracia para
// configurar 2FA (null = no aplica, o ya lo configuró). Lo lee el banner
// global (ver components/auth/Aviso2FA.tsx).
const AVISO_2FA_KEY = 'haskell.aviso2fa';

export type Usuario = {
  id: string;
  nombre: string;
  rol: string;
  canal: string | null;
  liderId?: string | null;
};

type Sesion = {
  accessToken: string;
  usuario: Usuario;
};

export function saveSession(sesion: Sesion) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(sesion));
}

function readSession(): Sesion | null {
  if (typeof window === 'undefined') return null;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Sesion;
  } catch {
    return null;
  }
}

export function getToken(): string | null {
  return readSession()?.accessToken ?? null;
}

export function getUsuario(): Usuario | null {
  return readSession()?.usuario ?? null;
}

export function clearSession() {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(STORAGE_KEY);
  window.localStorage.removeItem(AVISO_2FA_KEY);
}

export function isAuthenticated(): boolean {
  return getToken() !== null;
}

export function setAviso2FA(graciaHasta: string | null) {
  if (typeof window === 'undefined') return;
  if (graciaHasta) window.localStorage.setItem(AVISO_2FA_KEY, graciaHasta);
  else window.localStorage.removeItem(AVISO_2FA_KEY);
}

export function getAviso2FA(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(AVISO_2FA_KEY);
}
