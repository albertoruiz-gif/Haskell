'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { clearSession, getUsuario, Usuario } from '../../lib/auth';

const TABS = [
  { href: '/catalogo', label: 'Catálogo' },
  { href: '/carrito', label: 'Carrito' },
  { href: '/gestion', label: 'Gestión' },
  { href: '/almacen', label: 'Almacén' },
];

/**
 * Tabs superiores con la píldora magenta activa, tal como en los mockups
 * compartidos. Cada rol ve el subconjunto que le corresponde (RFD 3.2) —
 * el filtrado real de tabs por rol queda pendiente de conectar con el
 * modulo de identidad/auth.
 */
export function NavTabs() {
  const pathname = usePathname();
  const router = useRouter();
  const [usuario, setUsuario] = useState<Usuario | null>(null);

  // Se relee en cada cambio de ruta porque el login no navega con router.refresh().
  useEffect(() => {
    setUsuario(getUsuario());
  }, [pathname]);

  function cerrarSesion() {
    clearSession();
    router.push('/login');
  }

  return (
    <div className="space-y-2">
      {usuario && pathname !== '/login' && (
        <div className="flex items-center justify-between rounded-pill bg-white px-3 py-1.5 text-xs shadow-sm">
          <span className="text-bosque/70">
            {usuario.nombre} · <span className="text-bosque/50">{usuario.rol}</span>
          </span>
          <button onClick={cerrarSesion} className="font-medium text-acento">
            Cerrar sesión
          </button>
        </div>
      )}
      <nav className="flex gap-2 rounded-pill bg-white p-2 shadow-sm">
        {TABS.map((tab) => {
          const activo = pathname?.startsWith(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={
                activo
                  ? 'rounded-pill bg-acento px-4 py-2 text-sm font-medium text-white'
                  : 'rounded-pill px-4 py-2 text-sm font-medium text-bosque hover:bg-crema'
              }
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
