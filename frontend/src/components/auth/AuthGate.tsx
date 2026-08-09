'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { isAuthenticated } from '../../lib/auth';

// Rutas accesibles sin sesión — login y todo el flujo de activación/
// recuperación de clave (RF-001). Antes solo /login estaba en esta lista,
// así que /recuperar-password y /restablecer-password te devolvían al
// login sin mostrar nada (AuthGate las trataba como protegidas).
const RUTAS_PUBLICAS = ['/login', '/recuperar-password', '/restablecer-password'];

export function AuthGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [listo, setListo] = useState(false);

  useEffect(() => {
    if (pathname && RUTAS_PUBLICAS.includes(pathname)) {
      setListo(true);
      return;
    }
    if (!isAuthenticated()) {
      router.replace('/login');
      return;
    }
    setListo(true);
  }, [pathname, router]);

  if (!listo) return null;
  return <>{children}</>;
}
