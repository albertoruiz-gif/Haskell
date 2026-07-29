'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { clearSession, getUsuario, Usuario } from '../../lib/auth';
import { useCart } from '../cart/CartContext';
import { Logo } from './Logo';

const TABS = [
  { href: '/catalogo', label: 'Catálogo' },
  { href: '/carrito', label: 'Carrito' },
  { href: '/gestion', label: 'Gestión' },
  { href: '/almacen', label: 'Almacén' },
  { href: '/delivery', label: 'Delivery' },
];

// Qué pestañas puede usar cada rol, según los permisos reales del backend
// (RolesGuard de cada módulo) — antes se mostraban las cinco a todo el
// mundo y varias rechazaban al entrar. Un rol sin mapeo no ve ninguna
// pestaña extra (además de Cerrar sesión), en vez de mostrar las cinco por
// las dudas.
const TABS_POR_ROL: Record<string, string[]> = {
  ASESOR: ['/catalogo', '/carrito'],
  VENDEDOR: ['/catalogo', '/carrito'],
  LIDER_MINORISTA: ['/catalogo', '/carrito'],
  ADMINISTRADOR: ['/catalogo', '/gestion', '/almacen', '/delivery'],
  GERENTE_COMERCIAL: ['/catalogo', '/gestion'],
  GESTOR_CATALOGO: ['/catalogo', '/gestion'],
  FINANZAS: ['/gestion'],
  ALMACEN: ['/almacen', '/delivery'],
  TRANSPORTISTA: ['/delivery'],
};

/**
 * Tabs superiores con la píldora magenta activa, tal como en los mockups
 * compartidos. Cada rol ve el subconjunto que le corresponde (RFD 3.2) —
 * el filtrado real de tabs por rol queda pendiente de conectar con el
 * modulo de identidad/auth. En escritorio (lg+) todo entra en una sola
 * barra (logo + tabs + usuario) para aprovechar el ancho disponible; en
 * mobile queda apilado como antes.
 */
export function NavTabs() {
  const pathname = usePathname();
  const router = useRouter();
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const { items } = useCart();
  const totalItems = items.reduce((acc, i) => acc + i.cantidad, 0);

  // Se relee en cada cambio de ruta porque el login no navega con router.refresh().
  useEffect(() => {
    setUsuario(getUsuario());
  }, [pathname]);

  function cerrarSesion() {
    clearSession();
    router.push('/login');
  }

  const tabsVisibles = usuario ? TABS.filter((tab) => (TABS_POR_ROL[usuario.rol] ?? []).includes(tab.href)) : [];

  function Tabs() {
    return (
      <>
        {tabsVisibles.map((tab) => {
          const activo = pathname?.startsWith(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={
                activo
                  ? 'relative shrink-0 rounded-pill bg-acento px-4 py-2 text-sm font-medium text-white'
                  : 'relative shrink-0 rounded-pill px-4 py-2 text-sm font-medium text-bosque hover:bg-crema'
              }
            >
              {tab.label}
              {tab.href === '/carrito' && totalItems > 0 && (
                <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-pill bg-promo px-1 text-[10px] font-medium text-white">
                  {totalItems}
                </span>
              )}
            </Link>
          );
        })}
      </>
    );
  }

  return (
    <div className="space-y-2">
      {/* Escritorio: logo + tabs + usuario en una sola barra */}
      <div className="hidden items-center gap-4 rounded-pill bg-white py-2 pl-4 pr-2 shadow-sm lg:flex">
        <Logo />
        <nav className="flex flex-1 gap-2">
          <Tabs />
        </nav>
        {usuario && pathname !== '/login' && (
          <div className="flex shrink-0 items-center gap-3 text-xs">
            <span className="text-bosque/70">
              {usuario.nombre} · <span className="text-bosque/50">{usuario.rol}</span>
            </span>
            <button onClick={cerrarSesion} className="rounded-pill bg-crema px-3 py-1.5 font-medium text-acento">
              Cerrar sesión
            </button>
          </div>
        )}
      </div>

      {/* Mobile/tablet: apilado, logo arriba */}
      <div className="space-y-2 lg:hidden">
        <div className="flex items-center justify-between rounded-pill bg-white px-3 py-1.5 shadow-sm">
          <Logo />
          {usuario && pathname !== '/login' && (
            <div className="flex items-center gap-2 text-xs">
              <span className="hidden text-bosque/70 sm:inline">
                {usuario.nombre} · <span className="text-bosque/50">{usuario.rol}</span>
              </span>
              <button onClick={cerrarSesion} className="font-medium text-acento">
                Cerrar sesión
              </button>
            </div>
          )}
        </div>
        <nav className="flex gap-2 overflow-x-auto rounded-pill bg-white p-2 shadow-sm">
          <Tabs />
        </nav>
      </div>
    </div>
  );
}
