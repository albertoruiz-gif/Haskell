'use client';

// Pantalla "Gestión" — panel del gerente comercial/administrador: valida
// pagos y reservas (RN-016/RN-020), da de alta/baja asesores, administra
// precios/fotos de productos, crea ofertas temporales tipo pop-up, y
// gestiona transporte/delivery (transportistas, tarifario, despacho, pagos).

import { useEffect, useState } from 'react';
import { apiFetch, ApiError } from '../../lib/api';
import { AsesoresTab } from '../../components/admin/AsesoresTab';
import { CatalogoPreciosTab } from '../../components/admin/CatalogoPreciosTab';
import { CatalogoDigitalTab } from '../../components/admin/CatalogoDigitalTab';
import { OfertasTab } from '../../components/admin/OfertasTab';
import { PagosTab } from '../../components/admin/PagosTab';
import { TransporteTab } from '../../components/admin/TransporteTab';
import { PremiosTab } from '../../components/admin/PremiosTab';
import { ConfiguracionTab } from '../../components/admin/ConfiguracionTab';

const TABS = [
  { id: 'pagos', label: 'Pagos' },
  { id: 'asesores', label: 'Asesores' },
  { id: 'catalogo', label: 'Catálogo/Precios' },
  { id: 'catalogo-digital', label: 'Revista Digital' },
  { id: 'ofertas', label: 'Ofertas y Packs' },
  { id: 'transporte', label: 'Transporte' },
  { id: 'premios', label: 'Premios' },
  { id: 'configuracion', label: 'Configuración' },
] as const;

type TabId = (typeof TABS)[number]['id'];

type Pendientes = { pagos: number; catalogo: number; transporte: number };

export default function GestionPage() {
  const [tab, setTab] = useState<TabId>('pagos');
  const [pendientes, setPendientes] = useState<Pendientes>({ pagos: 0, catalogo: 0, transporte: 0 });
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
        {TABS.map((t) => {
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
      {tab === 'configuracion' && <ConfiguracionTab />}
    </div>
  );
}
