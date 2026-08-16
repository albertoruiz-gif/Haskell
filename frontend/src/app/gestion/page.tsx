'use client';

// Pantalla "Gestión" — panel del gerente comercial/administrador: valida
// pagos y reservas (RN-016/RN-020), da de alta/baja asesores, administra
// precios/fotos de productos, crea ofertas temporales tipo pop-up, y
// gestiona transporte/delivery (transportistas, tarifario, despacho, pagos).

import { useEffect, useState } from 'react';
import { apiFetch, ApiError } from '../../lib/api';
import { getUsuario } from '../../lib/auth';
import { AsesoresTab } from '../../components/admin/AsesoresTab';
import { CatalogoPreciosTab } from '../../components/admin/CatalogoPreciosTab';
import { CatalogoDigitalTab } from '../../components/admin/CatalogoDigitalTab';
import { OfertasTab } from '../../components/admin/OfertasTab';
import { PagosTab } from '../../components/admin/PagosTab';
import { TransporteTab } from '../../components/admin/TransporteTab';
import { PremiosTab } from '../../components/admin/PremiosTab';
import { ConfiguracionTab } from '../../components/admin/ConfiguracionTab';
import { AdministracionTab } from '../../components/admin/AdministracionTab';
import { CreditosTab } from '../../components/admin/CreditosTab';
import { DescuentosTab } from '../../components/admin/DescuentosTab';

const TABS = [
  { id: 'pagos', label: 'Pagos' },
  { id: 'asesores', label: 'Asesores' },
  { id: 'catalogo', label: 'Catálogo/Precios' },
  { id: 'catalogo-digital', label: 'Revista Digital' },
  { id: 'ofertas', label: 'Ofertas y Packs' },
  { id: 'transporte', label: 'Transporte' },
  { id: 'premios', label: 'Premios' },
  // EP-21: aprobación de línea de crédito — solo GERENTE_COMERCIAL/
  // ADMINISTRADOR, filtrado abajo igual que "administracion". El backend
  // también lo exige; esto es solo para no ofrecer un botón que 403ea.
  { id: 'creditos', label: 'Créditos' },
  // EP-04: descuento por volumen — GERENTE_COMERCIAL/GERENTE_GENERAL/
  // ADMINISTRADOR (más amplio que "creditos", que es solo Comercial).
  { id: 'descuentos', label: 'Descuentos' },
  { id: 'configuracion', label: 'Configuración' },
  // EP-18: cuentas administrativas (2FA) — solo ADMINISTRADOR, filtrado en
  // el render de abajo. El backend también lo exige; esto es nada más para
  // no mostrarle a otros roles un botón que les va a devolver 403.
  { id: 'administracion', label: 'Administración' },
] as const;

type TabId = (typeof TABS)[number]['id'];

type Pendientes = { pagos: number; catalogo: number; transporte: number };

export default function GestionPage() {
  const [tab, setTab] = useState<TabId>('pagos');
  const [pendientes, setPendientes] = useState<Pendientes>({ pagos: 0, catalogo: 0, transporte: 0 });
  const rol = getUsuario()?.rol;
  const esAdministrador = rol === 'ADMINISTRADOR';
  const puedeGestionarCreditos = rol === 'ADMINISTRADOR' || rol === 'GERENTE_COMERCIAL';
  const puedeGestionarDescuentos = rol === 'ADMINISTRADOR' || rol === 'GERENTE_COMERCIAL' || rol === 'GERENTE_GENERAL';
  const tabsVisibles = TABS.filter((t) => {
    if (t.id === 'administracion') return esAdministrador;
    if (t.id === 'creditos') return puedeGestionarCreditos;
    if (t.id === 'descuentos') return puedeGestionarDescuentos;
    return true;
  });
  // Compartido entre Catálogo/Precios y Ofertas: antes cada pestaña tenía su
  // propio selector de catálogo sin relación — elegir uno en una no lo
  // dejaba elegido en la otra (ver auditoría UX).
  const [catalogoActivoId, setCatalogoActivoId] = useState('');

  // Contadores de "qué necesita atención hoy" en cada pestaña — sin esto
  // había que entrar una por una para saber si había algo pendiente (ver
  // auditoría UX). Se recalculan cada vez que se cambia de pestaña, así
  // reflejan lo que se acaba de resolver.
  async function cargarPendientes() {
    try {
      const [pagos, catalogos, pagosTransportista] = await Promise.all([
        apiFetch<unknown[]>('/orders?estado=PENDIENTE_PAGO'),
        apiFetch<{ estado: string }[]>('/campaigns/catalogos'),
        apiFetch<unknown[]>('/operaciones/pagos-transportista?pagado=false'),
      ]);
      setPendientes({
        pagos: pagos.length,
        catalogo: catalogos.filter((c) => c.estado !== 'PUBLICADO').length,
        transporte: pagosTransportista.length,
      });
    } catch (err) {
      // Los contadores son un plus, no algo crítico — si el rol actual no
      // tiene acceso a alguno de estos endpoints, simplemente no se muestran.
      if (!(err instanceof ApiError)) throw err;
    }
  }

  useEffect(() => {
    cargarPendientes();
  }, [tab]);

  const CONTADOR: Partial<Record<TabId, number>> = {
    pagos: pendientes.pagos,
    catalogo: pendientes.catalogo,
    transporte: pendientes.transporte,
  };

  return (
    <div className="space-y-3">
      <h1 className="text-lg font-medium text-bosque">Panel de gestión</h1>

      <div className="flex flex-wrap gap-2">
        {tabsVisibles.map((t) => {
          const contador = CONTADOR[t.id];
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={
                tab === t.id
                  ? 'relative rounded-pill bg-acento px-4 py-2 text-sm font-medium text-white'
                  : 'relative rounded-pill bg-crema px-4 py-2 text-sm text-bosque'
              }
            >
              {t.label}
              {!!contador && (
                <span
                  className={
                    tab === t.id
                      ? 'ml-2 rounded-pill bg-white/25 px-1.5 py-0.5 text-[11px] font-semibold'
                      : 'ml-2 rounded-pill bg-promo px-1.5 py-0.5 text-[11px] font-semibold text-white'
                  }
                >
                  {contador}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {tab === 'pagos' && <PagosTab />}
      {tab === 'asesores' && <AsesoresTab />}
      {tab === 'catalogo' && <CatalogoPreciosTab catalogoId={catalogoActivoId} onCambiarCatalogo={setCatalogoActivoId} />}
      {tab === 'catalogo-digital' && <CatalogoDigitalTab />}
      {tab === 'ofertas' && (
        <OfertasTab catalogoId={catalogoActivoId} onCambiarCatalogo={setCatalogoActivoId} onIrACatalogoPrecios={() => setTab('catalogo')} />
      )}
      {tab === 'transporte' && <TransporteTab />}
      {tab === 'premios' && <PremiosTab />}
      {tab === 'creditos' && puedeGestionarCreditos && <CreditosTab />}
      {tab === 'descuentos' && puedeGestionarDescuentos && <DescuentosTab />}
      {tab === 'configuracion' && <ConfiguracionTab />}
      {tab === 'administracion' && esAdministrador && <AdministracionTab />}
    </div>
  );
}
