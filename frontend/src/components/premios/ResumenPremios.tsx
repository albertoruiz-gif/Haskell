'use client';

// Resumen de premios del asesor — Carrito (RF pedido por Alberto 2026-08-07):
// cuánto lleva vendido este mes y cuánto le falta para el próximo nivel de
// la escala que armó su Gerente Comercial en Gestión → Premios. Reinicia
// cada mes; el histórico (para la gráfica) sí queda guardado porque se
// recalcula siempre desde los pedidos reales, nunca se pisa.

import { useEffect, useState } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { apiFetch, ApiError } from '../../lib/api';
import { formatoSoles, pctAvance, type ProgresoPremio, type SeriePremio } from '../../lib/premios';

export function ResumenPremios() {
  const [progreso, setProgreso] = useState<ProgresoPremio | null>(null);
  const [serie, setSerie] = useState<SeriePremio | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [verGrafica, setVerGrafica] = useState(false);

  useEffect(() => {
    apiFetch<ProgresoPremio>('/premios/mi-resumen')
      .then(setProgreso)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'No se pudo cargar tu progreso de premios.'));
  }, []);

  useEffect(() => {
    if (!verGrafica || serie) return;
    apiFetch<SeriePremio>('/premios/mi-serie?meses=6').then(setSerie).catch(() => {});
  }, [verGrafica, serie]);

  if (error) return null; // no bloquea el checkout si esto falla
  if (!progreso) return null;

  const { ventaDelMes, nivelActual, nivelSiguiente, faltante } = progreso;
  const avance = pctAvance(progreso);

  return (
    <div className="rounded-card bg-white p-3 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-bosque">Tus premios este mes</p>
        <button onClick={() => setVerGrafica((v) => !v)} className="text-xs text-acento underline">
          {verGrafica ? 'Ocultar histórico' : 'Ver histórico'}
        </button>
      </div>

      <p className="mt-1 text-xs text-bosque/60">
        Llevas vendido <span className="font-medium text-bosque">{formatoSoles(ventaDelMes)}</span> este mes
        {nivelActual && <> — ya alcanzaste <span className="font-medium text-acento">{nivelActual.nombre}</span></>}.
      </p>

      <div className="mt-2 h-2 w-full overflow-hidden rounded-pill bg-crema">
        <div className="h-full rounded-pill bg-acento transition-all" style={{ width: `${avance}%` }} />
      </div>

      {nivelSiguiente ? (
        <p className="mt-1 text-xs text-bosque/60">
          Te faltan <span className="font-medium text-bosque">{formatoSoles(faltante ?? 0)}</span> para{' '}
          <span className="font-medium text-acento">{nivelSiguiente.nombre}</span>
          {nivelSiguiente.descripcion && <span className="text-bosque/40"> ({nivelSiguiente.descripcion})</span>}.
        </p>
      ) : (
        <p className="mt-1 text-xs text-bosque/60">
          {nivelActual ? 'Ya alcanzaste el nivel más alto de la escala este mes 🎉' : 'Todavía no hay una escala de premios activa para tu canal.'}
        </p>
      )}

      {verGrafica && (
        <div className="mt-3 border-t border-musgo/10 pt-2">
          {!serie && <p className="py-4 text-center text-xs text-bosque/40">Cargando…</p>}
          {serie && (
            <ResponsiveContainer width="100%" height={140}>
              <BarChart data={serie.puntos} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1F4A2E" strokeOpacity={0.08} />
                <XAxis dataKey="etiqueta" tick={{ fontSize: 10, fill: '#1F4A2E' }} />
                <YAxis tick={{ fontSize: 10, fill: '#1F4A2E' }} width={50} tickFormatter={(v: number) => `S/${v}`} />
                <Tooltip
                  formatter={(valor: number) => formatoSoles(valor)}
                  labelFormatter={(_, payload) => payload?.[0]?.payload?.nivelActual ?? ''}
                />
                <Bar dataKey="venta" name="Vendido" fill="#1F4A2E" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      )}
    </div>
  );
}
