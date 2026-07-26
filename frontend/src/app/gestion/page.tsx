'use client';

// Pantalla "Gestión" — panel del gerente comercial/administrador: valida
// pagos y reservas (RN-016/RN-020), da de alta/baja asesores, administra
// precios/fotos de productos, crea ofertas temporales tipo pop-up, y
// gestiona transporte/delivery (transportistas, tarifario, despacho, pagos).

import { useState } from 'react';
import { AsesoresTab } from '../../components/admin/AsesoresTab';
import { CatalogoPreciosTab } from '../../components/admin/CatalogoPreciosTab';
import { OfertasTab } from '../../components/admin/OfertasTab';
import { PagosTab } from '../../components/admin/PagosTab';
import { TransporteTab } from '../../components/admin/TransporteTab';

const TABS = [
  { id: 'pagos', label: 'Pagos' },
  { id: 'asesores', label: 'Asesores' },
  { id: 'catalogo', label: 'Catálogo/Precios' },
  { id: 'ofertas', label: 'Ofertas' },
  { id: 'transporte', label: 'Transporte' },
] as const;

type TabId = (typeof TABS)[number]['id'];

export default function GestionPage() {
  const [tab, setTab] = useState<TabId>('pagos');

  return (
    <div className="space-y-3">
      <h1 className="text-lg font-medium text-bosque">Panel de gestión</h1>

      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={
              tab === t.id
                ? 'rounded-pill bg-acento px-4 py-2 text-sm font-medium text-white'
                : 'rounded-pill bg-crema px-4 py-2 text-sm text-bosque'
            }
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'pagos' && <PagosTab />}
      {tab === 'asesores' && <AsesoresTab />}
      {tab === 'catalogo' && <CatalogoPreciosTab />}
      {tab === 'ofertas' && <OfertasTab />}
      {tab === 'transporte' && <TransporteTab />}
    </div>
  );
}
