'use client';

// Ranking de productos/categorías más vendidos con drill-down al hacer clic
// (RF 2026-08-07/08) — mismo componente para el tablero gerencial
// (/indicadores/productos-top) y "Mis Ventas" del asesor
// (/indicadores/mis-productos-top), solo cambia el endpoint que se le pasa.
// Barra horizontal en vez de pie: con 1-2 categorías (caso normal de un
// asesor) el pie queda todo relleno y las etiquetas se pisan; la barra
// ordenada de mayor a menor se lee bien con cualquier cantidad.

import { useEffect, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { apiFetch } from '../../lib/api';

const COLORES = ['#1F4A2E', '#8A9A4E', '#D6336C', '#F4A100', '#4A6FA5', '#A0522D', '#6B4C9A', '#2E8B8B'];

type Dato = { clave: string; monto: number; cantidad: number };

export function ProductosTopPie({ endpoint, titulo = 'Productos más vendidos' }: { endpoint: string; titulo?: string }) {
  const [categoria, setCategoria] = useState<string | null>(null);
  const [datos, setDatos] = useState<Dato[] | null>(null);

  useEffect(() => {
    const nivel = categoria ? 'producto' : 'categoria';
    const q = categoria ? `&categoria=${encodeURIComponent(categoria)}` : '';
    setDatos(null);
    apiFetch<Dato[]>(`${endpoint}?nivel=${nivel}${q}`).then(setDatos).catch(() => setDatos([]));
  }, [endpoint, categoria]);

  return (
    <div className="rounded-card bg-white p-3 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-bosque">{categoria ? `${titulo} — ${categoria}` : titulo}</p>
        {categoria && (
          <button onClick={() => setCategoria(null)} className="text-xs text-acento underline">
            ← Volver a categorías
          </button>
        )}
      </div>

      {!datos && <p className="py-8 text-center text-xs text-bosque/40">Cargando…</p>}
      {datos && datos.length === 0 && <p className="py-8 text-center text-xs text-bosque/40">Sin ventas este mes todavía.</p>}
      {datos && datos.length > 0 && (
        <ResponsiveContainer width="100%" height={Math.max(120, datos.length * 36)}>
          <BarChart data={datos} layout="vertical" margin={{ top: 4, right: 16, left: 4, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1F4A2E" strokeOpacity={0.08} horizontal={false} />
            <XAxis type="number" tick={{ fontSize: 10, fill: '#1F4A2E' }} tickFormatter={(v: number) => `S/${v}`} />
            <YAxis type="category" dataKey="clave" width={110} tick={{ fontSize: 11, fill: '#1F4A2E' }} />
            <Tooltip
              formatter={(v: number, _n, item: any) => [`S/ ${v.toLocaleString('es-PE', { minimumFractionDigits: 2 })}`, `${item.payload.cantidad} unid.`]}
            />
            <Bar
              dataKey="monto"
              radius={[0, 4, 4, 0]}
              onClick={(d: any) => !categoria && setCategoria(d.clave)}
              cursor={categoria ? 'default' : 'pointer'}
            >
              {datos.map((_, i) => (
                <Cell key={i} fill={COLORES[i % COLORES.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
      {!categoria && datos && datos.length > 0 && <p className="text-center text-[11px] text-bosque/40">Clic en una barra para ver los productos</p>}
    </div>
  );
}
