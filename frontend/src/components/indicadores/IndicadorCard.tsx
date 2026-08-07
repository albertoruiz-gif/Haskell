'use client';

import { calcularEstado, ESTADO_COLOR, ESTADO_LABEL, formatearValor, infoIndicador } from '../../lib/indicadores';
import type { ValorIndicador } from '../../lib/indicadores';

/**
 * Card grande de indicador — clic abre el panel de drill-down (sección 2
 * del prompt). El punto de color es el semáforo de estado (a favor/alerta/
 * riesgo) según valorActual vs meta; "pendiente de cálculo" nunca se
 * confunde con un 0 real.
 */
export function IndicadorCard({ dato, onClick }: { dato: ValorIndicador; onClick: () => void }) {
  const info = infoIndicador(dato.indicador);
  const estado = calcularEstado(dato.valorActual, dato.meta, info.menorEsMejor);

  return (
    <button
      onClick={onClick}
      className="flex flex-col items-start gap-2 rounded-card bg-white p-4 text-left shadow-sm transition hover:shadow-md"
    >
      <div className="flex w-full items-center gap-2">
        <span className={`h-2 w-2 rounded-pill ${ESTADO_COLOR[estado]}`} />
        <span className="text-xs font-medium uppercase text-bosque/60">{info.label}</span>
      </div>
      <p className={`text-2xl font-semibold ${dato.valorActual === null ? 'text-bosque/30' : 'text-bosque'}`}>
        {formatearValor(dato.valorActual, info.unidad)}
      </p>
      <div className="flex w-full items-center justify-between text-xs">
        <span className="text-bosque/50">Meta: {dato.meta !== null ? formatearValor(dato.meta, info.unidad) : 'sin definir'}</span>
        <span className="font-medium text-bosque/50">{ESTADO_LABEL[estado]}</span>
      </div>
    </button>
  );
}
