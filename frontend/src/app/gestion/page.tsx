'use client';

// Pantalla "Gestión" — panel del gerente comercial/administrador: valida
// pagos y reservas (RN-016/RN-020), da de alta/baja asesores, administra
// precios/fotos de productos y crea ofertas temporales tipo pop-up.

import { useState } from 'react';
import { AsesoresTab } from '../../components/admin/AsesoresTab';
import { CatalogoPreciosTab } from '../../components/admin/CatalogoPreciosTab';
import { OfertasTab } from '../../components/admin/OfertasTab';

const PEDIDOS_EJEMPLO = [
  { id: '#00234', asesor: 'Rosa Mendoza', lugar: 'Los Olivos', monto: 187.5, estado: 'Reservado', detalle: 'Stock reservado · vence en 18 min si no se valida el pago' },
  { id: '#00235', asesor: 'Karla Torres', lugar: 'San Borja', monto: 96.3, estado: 'En revisión' },
  { id: '#00236', asesor: 'Milagros Paredes', lugar: 'Comas', monto: 245.0, estado: 'Validado', detalle: 'Mercadería liberada para despacho' },
  { id: '#00237', asesor: 'Diana Ruiz', lugar: 'Surco', monto: 58.0, estado: 'Rechazado', detalle: 'Reserva vencida — stock liberado' },
];

const COLOR_ESTADO: Record<string, string> = {
  Reservado: 'bg-promo text-white',
  'En revisión': 'bg-musgo/20 text-musgo-dark',
  Validado: 'bg-bosque text-white',
  Rechazado: 'bg-red-100 text-red-700',
};

const TABS = [
  { id: 'pagos', label: 'Pagos' },
  { id: 'asesores', label: 'Asesores' },
  { id: 'catalogo', label: 'Catálogo/Precios' },
  { id: 'ofertas', label: 'Ofertas' },
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

      {tab === 'pagos' && (
        <div className="space-y-2">
          <p className="text-xs text-bosque/60">Reserva de mercadería: 30 min desde el pedido, hasta validar el pago</p>
          {PEDIDOS_EJEMPLO.map((p) => (
            <div key={p.id} className="rounded-card bg-white p-3 shadow-sm">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium">Pedido {p.id} · {p.asesor}</p>
                  <p className="text-xs text-bosque/60">{p.lugar} · S/ {p.monto.toFixed(2)}</p>
                </div>
                <span className={`rounded-pill px-3 py-1 text-xs font-medium ${COLOR_ESTADO[p.estado]}`}>{p.estado}</span>
              </div>
              {p.detalle && <p className="mt-2 rounded-card bg-crema p-2 text-xs text-bosque/70">{p.detalle}</p>}
              {p.estado === 'Reservado' && (
                <button className="mt-2 w-full rounded-pill bg-crema py-2 text-xs font-medium text-acento">
                  Rechazar y liberar stock
                </button>
              )}
              {p.estado === 'En revisión' && (
                <div className="mt-2 flex gap-2">
                  <button className="flex-1 rounded-pill bg-bosque py-2 text-xs font-medium text-white">Validar pago</button>
                  <button className="flex-1 rounded-pill bg-crema py-2 text-xs font-medium text-acento">Rechazar</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {tab === 'asesores' && <AsesoresTab />}
      {tab === 'catalogo' && <CatalogoPreciosTab />}
      {tab === 'ofertas' && <OfertasTab />}
    </div>
  );
}
