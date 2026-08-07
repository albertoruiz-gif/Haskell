'use client';

// Tablero de indicadores gerenciales — 6 pestañas (ver
// docs/PROMPT_dashboard_indicadores_frontend.md). Acceso: ADMINISTRADOR,
// GERENTE_GENERAL, GERENTE_COMERCIAL, FINANZAS (mismos roles que el
// backend exige en IndicadoresController/MetasController — si algún día
// se desalinean, el usuario vería la pestaña pero la API le devolvería 403,
// así que este guard es solo para no mostrar una pantalla que va a fallar).

import { useState } from 'react';
import { getUsuario } from '../../lib/auth';
import { GerencialTab } from '../../components/indicadores/GerencialTab';
import { ComercialTab } from '../../components/indicadores/ComercialTab';
import { TabIndicadores } from '../../components/indicadores/TabIndicadores';
import { MetasTab } from '../../components/indicadores/MetasTab';

const ROLES_PERMITIDOS = ['ADMINISTRADOR', 'GERENTE_GENERAL', 'GERENTE_COMERCIAL', 'FINANZAS'];

const TABS = [
  { id: 'gerencial', label: 'Gerencial' },
  { id: 'comercial', label: 'Comercial' },
  { id: 'finanzas', label: 'Finanzas' },
  { id: 'operaciones', label: 'Operaciones' },
  { id: 'marketing', label: 'Marketing digital' },
  { id: 'metas', label: 'Metas' },
] as const;

type TabId = (typeof TABS)[number]['id'];

export default function IndicadoresPage() {
  const [tab, setTab] = useState<TabId>('gerencial');
  const usuario = getUsuario();

  if (!usuario || !ROLES_PERMITIDOS.includes(usuario.rol)) {
    return (
      <div className="rounded-card bg-white p-4 text-sm text-bosque/60 shadow-sm">
        No tenés acceso al tablero de indicadores.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h1 className="text-lg font-medium text-bosque">Tablero de indicadores</h1>

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

      {tab === 'gerencial' && <GerencialTab onIrAPestana={setTab} />}
      {tab === 'comercial' && <ComercialTab />}
      {tab === 'finanzas' && <TabIndicadores endpoint="/indicadores/finanzas" tituloComposicion="Rentabilidad por canal" />}
      {tab === 'operaciones' && <TabIndicadores endpoint="/indicadores/operaciones" tituloComposicion="Pedidos por estado" />}
      {tab === 'marketing' && <TabIndicadores endpoint="/indicadores/marketing" />}
      {tab === 'metas' && <MetasTab />}
    </div>
  );
}
