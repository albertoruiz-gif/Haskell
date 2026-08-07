'use client';

// Pantalla de premios del asesor — Carrito (RF pedido por Alberto
// 2026-08-07, ampliado 2026-08-07 tras revisar que no se veía clara:
// cómo va en la semana, el acumulado del mes, cuántos premios ganó en total
// y cuánto le falta para el próximo. Todo siempre visible, no hay nada
// escondido detrás de un "ver más" — ese fue justamente el problema antes.

import { useEffect, useState } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { apiFetch, ApiError } from '../../lib/api';
import { formatoSoles, pctAvance, type HistorialPremios, type ProgresoPremio, type SeriePremio } from '../../lib/premios';

export function ResumenPremios() {
  const [progreso, setProgreso] = useState<ProgresoPremio | null>(null);
  const [serie, setSerie] = useState<SeriePremio | null>(null);
  const [historial, setHistorial] = useState<HistorialPremios | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<ProgresoPremio>('/premios/mi-resumen')
      .then(setProgreso)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'No se pudo cargar tu progreso de premios.'));
    apiFetch<SeriePremio>('/premios/mi-serie?meses=6').then(setSerie).catch(() => {});
    apiFetch<HistorialPremios>('/premios/mi-historial').then(setHistorial).catch(() => {});
  }, []);

  if (error) return null; // no bloquea el checkout si esto falla
  if (!progreso) return <div className="rounded-card bg-white p-3 shadow-sm"><p className="text-xs text-bosque/40">Cargando tu progreso de premios…</p></div>;

  const { ventaSemana, ventaDelMes, nivelActual, nivelSiguiente, faltante } = progreso;
  const avance = pctAvance(progreso);

  return (
    <div className="rounded-card bg-white p-3 shadow-sm">
      <p className="text-sm font-medium text-bosque">Tus premios</p>

      <div className="mt-2 grid grid-cols-2 gap-2">
        <div className="rounded-card bg-crema p-2">
          <p className="text-[11px] uppercase text-bosque/50">Esta semana</p>
          <p className="text-base font-semibold text-bosque">{formatoSoles(ventaSemana)}</p>
        </div>
        <div className="rounded-card bg-crema p-2">
          <p className="text-[11px] uppercase text-bosque/50">Este mes</p>
          <p className="text-base font-semibold text-bosque">{formatoSoles(ventaDelMes)}</p>
        </div>
      </div>

      <p className="mt-2 text-xs text-bosque/60">
        {nivelActual ? (
          <>Ya alcanzaste <span className="font-medium text-acento">{nivelActual.nombre}</span> este mes.</>
        ) : (
          'Todavía no alcanzás ningún nivel este mes.'
        )}
      </p>

      <div className="mt-1 h-2 w-full overflow-hidden rounded-pill bg-crema">
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

      <div className="mt-3 border-t border-musgo/10 pt-2">
        <p className="mb-1 text-xs font-medium text-bosque">Últimos 6 meses</p>
        {!serie && <p className="py-4 text-center text-xs text-bosque/40">Cargando…</p>}
        {serie && (
          <ResponsiveContainer width="100%" height={130}>
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

      <div className="mt-3 border-t border-musgo/10 pt-2">
        <p className="text-xs font-medium text-bosque">
          Premios ganados{historial && <span className="text-bosque/50"> ({historial.totalPremiosGanados})</span>}
        </p>
        {!historial && <p className="py-2 text-xs text-bosque/40">Cargando…</p>}
        {historial && historial.logros.length === 0 && (
          <p className="py-1 text-xs text-bosque/50">Todavía no ganaste ningún premio — seguí vendiendo para desbloquear el primero.</p>
        )}
        {historial && historial.logros.length > 0 && (
          <ul className="mt-1 space-y-1">
            {historial.logros.map((l, i) => (
              <li key={i} className="flex items-center justify-between text-xs">
                <span className="text-bosque/60">{l.mes}</span>
                <span className="rounded-pill bg-crema px-2 py-0.5 font-medium text-acento">🏆 {l.nivel}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
