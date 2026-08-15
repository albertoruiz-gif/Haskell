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
  { href: '/mis-ventas', label: 'Mis Ventas' },
  // EP-21: solo tiene sentido en Salón/Retail — la propia página avisa si
  // el canal no aplica, pero igual se filtra acá para no mostrar un link
  // muerto a los Asesores de Comercio Minorista.
  { href: '/mis-clientes', label: 'Mis Clientes' },
  { href: '/gestion', label: 'Gestión' },
  { href: '/almacen', label: 'Almacén' },
  { href: '/delivery', label: 'Delivery' },
  { href: '/indicadores', label: 'Indicadores' },
  { href: '/mi-equipo', label: 'Mi equipo' },
];

// Qué pestañas puede usar cada rol, según los permisos reales del backend
// (RolesGuard de cada módulo) — antes se mostraban las cinco a todo el
// mundo y varias rechazaban al entrar. Un rol sin mapeo no ve ninguna
// pestaña extra (además de Cerrar sesión), en vez de mostrar las cinco por
// las dudas.
const TABS_POR_ROL: Record<string, string[]> = {
  ASESOR: ['/catalogo', '/carrito', '/mis-ventas', '/mis-clientes'],
  VENDEDOR: ['/catalogo', '/carrito', '/mis-ventas', '/mis-clientes'],
  // Los Líderes tienen su propia pestaña acotada a su equipo, no el
  // tablero gerencial completo (ver docs/PROMPT_dashboard_indicadores_frontend.md sección 5).
  LIDER_MINORISTA: ['/gestion', '/mi-equipo'],
  ADMINISTRADOR: ['/catalogo', '/gestion', '/almacen', '/delivery', '/indicadores'],
  GERENTE_GENERAL: ['/indicadores'],
  GERENTE_COMERCIAL: ['/catalogo', '/gestion', '/indicadores'],
  GESTOR_CATALOGO: ['/catalogo', '/gestion'],
  FINANZAS: ['/gestion', '/indicadores'],
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

  const requiereCliente = usuario?.canal === 'SALONES_BELLEZA' || usuario?.canal === 'RETAIL';
  const tabsVisibles = usuario
    ? TABS.filter((tab) => {
        if (!(TABS_POR_ROL[usuario.rol] ?? []).includes(tab.href)) return false;
        if (tab.href === '/mis-clientes') return requiereCliente;
        return true;
      })
    : [];

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
        <Logo className="h-16" />
        <nav className="flex flex-1 gap-2">
          <Tabs />
        </nav>
        {usuario && pathname !== '/login' && (
          <div className="flex shrink-0 items-center gap-3 text-xs">
            <Link href="/mi-cuenta" className="text-bosque/70 hover:text-acento">
              {usuario.nombre} · <span className="text-bosque/50">{usuario.rol}</span>
            </Link>
            <button onClick={cerrarSesion} className="rounded-pill bg-crema px-3 py-1.5 font-medium text-acento">
              Cerrar sesión
            </button>
          </div>
        )}
      </div>

      {/* Mobile/tablet: apilado, logo arriba */}
      <div className="space-y-2 lg:hidden">
        <div className="flex items-center justify-between rounded-pill bg-white px-3 py-1.5 shadow-sm">
          <Logo className="h-12" />
          {usuario && pathname !== '/login' && (
            <div className="flex items-center gap-2 text-xs">
              <Link href="/mi-cuenta" className="hidden text-bosque/70 hover:text-acento sm:inline">
                {usuario.nombre} · <span className="text-bosque/50">{usuario.rol}</span>
              </Link>
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
