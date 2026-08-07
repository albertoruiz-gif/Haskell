'use client';

// Empujón motivacional en el Carrito, justo antes de pagar (RF 2026-08-07).
// A propósito liviano: el reporte completo (semana/mes, histórico, premios
// ganados, productos más vendidos) vive en "Mis Ventas" — mezclar todo acá
// hacía que el Carrito se sintiera desordenado (feedback del usuario).

import { useEffect, useState } from 'react';
import { apiFetch, ApiError } from '../../lib/api';
import { formatoSoles, pctAvance, type ProgresoPremio } from '../../lib/premios';

export function ResumenPremios() {
  const [progreso, setProgreso] = useState<ProgresoPremio | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<ProgresoPremio>('/premios/mi-resumen')
      .then(setProgreso)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'No se pudo cargar tu progreso de premios.'));
  }, []);

  if (error || !progreso) return null; // no bloquea el checkout si esto falla
  const { ventaDelMes, nivelActual, nivelSiguiente, faltante } = progreso;

  return (
    <div className="rounded-card bg-white p-3 shadow-sm">
      <p className="text-sm font-medium text-bosque">Tus premios este mes</p>
      <p className="mt-1 text-xs text-bosque/60">
        Llevas vendido <span className="font-medium text-bosque">{formatoSoles(ventaDelMes)}</span>
        {nivelActual && <> — ya alcanzaste <span className="font-medium text-acento">{nivelActual.nombre}</span></>}.
      </p>
      <div className="mt-2 h-2 w-full overflow-hidden rounded-pill bg-crema">
        <div className="h-full rounded-pill bg-acento transition-all" style={{ width: `${pctAvance(progreso)}%` }} />
      </div>
      {nivelSiguiente ? (
        <p className="mt-1 text-xs text-bosque/60">
          Te faltan <span className="font-medium text-bosque">{formatoSoles(faltante ?? 0)}</span> para{' '}
          <span className="font-medium text-acento">{nivelSiguiente.nombre}</span>.
        </p>
      ) : (
        nivelActual && <p className="mt-1 text-xs text-bosque/60">Ya alcanzaste el nivel más alto de la escala este mes 🎉</p>
      )}
      <a href="/mis-ventas" className="mt-2 block text-xs text-acento underline">
        Ver historial completo en Mis Ventas →
      </a>
    </div>
  );
}
