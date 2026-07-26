'use client';

// Administración de transporte: alta de transportistas, tarifario de
// envío y pagos. El seguimiento operativo del despacho (asignar
// transportista, tracking) es tarea de Almacén y vive en /delivery.

import { useState } from 'react';
import { TransportistasSection } from './transporte/TransportistasSection';
import { TarifarioSection } from './transporte/TarifarioSection';
import { PagosSection } from './transporte/PagosSection';

const SUBTABS = [
  { id: 'transportistas', label: 'Transportistas' },
  { id: 'tarifario', label: 'Tarifario' },
  { id: 'pagos', label: 'Pagos' },
] as const;

type SubtabId = (typeof SUBTABS)[number]['id'];

export function TransporteTab() {
  const [sub, setSub] = useState<SubtabId>('transportistas');

  return (
    <div className="space-y-3">
      <p className="text-xs text-bosque/50">
        El seguimiento del despacho (asignar transportista, tracking de entregas) lo maneja Almacén desde la pestaña <strong>Delivery</strong>.
      </p>
      <div className="flex flex-wrap gap-2">
        {SUBTABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setSub(t.id)}
            className={
              sub === t.id
                ? 'rounded-pill bg-musgo px-3 py-1.5 text-xs font-medium text-white'
                : 'rounded-pill border border-musgo/30 px-3 py-1.5 text-xs text-bosque'
            }
          >
            {t.label}
          </button>
        ))}
      </div>

      {sub === 'transportistas' && <TransportistasSection />}
      {sub === 'tarifario' && <TarifarioSection />}
      {sub === 'pagos' && <PagosSection />}
    </div>
  );
}
