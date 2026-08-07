'use client';

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { CANAL_LABEL, formatearEje, formatearValor, type Unidad } from '../../lib/indicadores';
import { PendienteCalculo } from './PendienteCalculo';

export type DatoComposicion = { canal: string; valor: number };

/**
 * Barras por canal (ventas por canal / rentabilidad por canal / pedidos por
 * estado según la pestaña) — usa los 3 valores reales del enum Canal, no 4
 * como en la maqueta de chat. "Ventas por canal" (Comercial) ya es real,
 * consume GET /indicadores/comercial/ventas-por-canal. Las otras pestañas
 * todavía no tienen el desglose calculado y siguen mostrando `datos: null`.
 */
export function GraficaComposicion({ titulo, datos, unidad = 'moneda' }: { titulo: string; datos: DatoComposicion[] | null; unidad?: Unidad }) {
  const datosConLabel = (datos ?? []).map((d) => ({ ...d, label: CANAL_LABEL[d.canal] ?? d.canal }));

  return (
    <div className="rounded-card bg-white p-4 shadow-sm">
      <p className="mb-2 text-sm font-medium text-bosque">{titulo}</p>
      {datosConLabel.length === 0 ? (
        <PendienteCalculo mensaje="Sin desglose por canal todavía" />
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={datosConLabel}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1F4A2E" strokeOpacity={0.08} />
            <XAxis dataKey="label" tick={{ fontSize: 12, fill: '#1F4A2E' }} />
            <YAxis tick={{ fontSize: 12, fill: '#1F4A2E' }} tickFormatter={(v: number) => formatearEje(v, unidad)} width={70} />
            <Tooltip formatter={(valor: number) => formatearValor(valor, unidad)} />
            <Bar dataKey="valor" fill="#1F4A2E" radius={[8, 8, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
