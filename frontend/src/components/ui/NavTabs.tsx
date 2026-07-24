'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

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

  return (
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
  );
}
