const STORAGE_KEY = 'haskell.sesion';

export type Usuario = {
  id: string;
  nombre: string;
  rol: string;
  canal: string | null;
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
}

export function isAuthenticated(): boolean {
  return getToken() !== null;
}
