'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { isAuthenticated } from '../../lib/auth';

// Rutas accesibles sin sesión — login, el flujo de activación/
// recuperación de clave (RF-001), y la vitrina pública + páginas legales
// que exige Culqi para aprobar la afiliación (ver
// docs/PROMPT_culqi_requisitos_web.md) — sin esto, un visitante sin cuenta
// (incluido el revisor de Culqi) solo veía la pantalla de login.
const RUTAS_PUBLICAS = ['/', '/login', '/recuperar-password', '/restablecer-password', '/contacto'];
const PREFIJOS_PUBLICOS = ['/legal/'];

function esRutaPublica(pathname: string): boolean {
  return RUTAS_PUBLICAS.includes(pathname) || PREFIJOS_PUBLICOS.some((p) => pathname.startsWith(p));
}

export function AuthGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [listo, setListo] = useState(false);

  useEffect(() => {
    if (pathname && esRutaPublica(pathname)) {
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
