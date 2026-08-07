'use client';

// Pie de productos/categorías más vendidos con drill-down al hacer clic
// (RF 2026-08-07) — mismo componente para el tablero gerencial
// (/indicadores/productos-top) y para "Mis Ventas" del asesor
// (/indicadores/mis-productos-top), solo cambia el endpoint que se le pasa.

import { useEffect, useState } from 'react';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
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
        <ResponsiveContainer width="100%" height={240}>
          <PieChart>
            <Pie
              data={datos}
              dataKey="monto"
              nameKey="clave"
              cx="50%"
              cy="50%"
              outerRadius={90}
              label={(d: { clave: string }) => d.clave}
              onClick={(d: { clave: string }) => !categoria && setCategoria(d.clave)}
              cursor={categoria ? 'default' : 'pointer'}
            >
              {datos.map((_, i) => (
                <Cell key={i} fill={COLORES[i % COLORES.length]} />
              ))}
            </Pie>
            <Tooltip formatter={(v: number) => `S/ ${v.toLocaleString('es-PE', { minimumFractionDigits: 2 })}`} />
          </PieChart>
        </ResponsiveContainer>
      )}
      {!categoria && datos && datos.length > 0 && <p className="text-center text-[11px] text-bosque/40">Clic en una porción para ver los productos</p>}
    </div>
  );
}
