'use client';

// Vista del Líder de equipo (rol LIDER_MINORISTA) — ranking de sus propios
// asesores por venta, la comisión de cada uno y la comisión propia del
// líder (comisionPct % del total vendido por su equipo). Pedido por
// Alberto 2026-08-06 como pestaña aparte del tablero gerencial (ese
// depende de Odoo y todavía no calcula nada real; esto sí es 100% real
// hoy, consume backend/src/modules/lideres/lideres.service.ts).

import { Fragment, useEffect, useState } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { apiFetch, ApiError } from '../../lib/api';
import { getUsuario } from '../../lib/auth';
import { ErrorBanner } from '../../components/ui/ErrorBanner';
import { formatoSoles as formatoSolesPremios, type SeriePremio } from '../../lib/premios';

type ResumenAsesor = {
  asesorId: string;
  codigo: string;
  nombre: string;
  distrito: string | null;
  totalVentaPvp: number;
  comisionAsesor: number;
  cantidadPedidos: number;
  premioActual: string | null;
  premioSiguiente: string | null;
  faltantePremio: number | null;
};

type ResumenEquipo = {
  comisionPct: number;
  totalVentaPvp: number;
  comisionGanada: number;
  cantidadPedidos: number;
  cantidadAsesores: number;
  asesores: ResumenAsesor[];
};

function formatoSoles(valor: number): string {
  return `S/ ${valor.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function MiEquipoPage() {
  const [resumen, setResumen] = useState<ResumenEquipo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);
  const [asesorExpandido, setAsesorExpandido] = useState<string | null>(null);

  useEffect(() => {
    const usuario = getUsuario();
    if (!usuario?.liderId) {
      setError('Tu usuario no está vinculado a ningún equipo de líder.');
      setCargando(false);
      return;
    }
    apiFetch<ResumenEquipo>(`/lideres/${usuario.liderId}/equipo`)
      .then(setResumen)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'No se pudo cargar el resumen de tu equipo.'))
      .finally(() => setCargando(false));
  }, []);

  return (
    <div className="space-y-3">
      <h1 className="text-lg font-medium text-bosque">Mi equipo</h1>
      <ErrorBanner mensaje={error} />
      {cargando && <p className="text-xs text-bosque/50">Cargando…</p>}

      {resumen && (
        <>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <div className="rounded-card bg-white p-4 shadow-sm">
              <p className="text-xs font-medium uppercase text-bosque/60">Mi comisión ({resumen.comisionPct}%)</p>
              <p className="mt-1 text-2xl font-semibold text-bosque">{formatoSoles(resumen.comisionGanada)}</p>
            </div>
            <div className="rounded-card bg-white p-4 shadow-sm">
              <p className="text-xs font-medium uppercase text-bosque/60">Total vendido por el equipo</p>
              <p className="mt-1 text-2xl font-semibold text-bosque">{formatoSoles(resumen.totalVentaPvp)}</p>
            </div>
            <div className="rounded-card bg-white p-4 shadow-sm">
              <p className="text-xs font-medium uppercase text-bosque/60">Pedidos / Asesores</p>
              <p className="mt-1 text-2xl font-semibold text-bosque">
                {resumen.cantidadPedidos} <span className="text-sm font-normal text-bosque/50">/ {resumen.cantidadAsesores}</span>
              </p>
            </div>
          </div>

          <div className="rounded-card bg-white p-4 shadow-sm">
            <p className="mb-2 text-sm font-medium text-bosque">Ranking de asesores</p>
            {resumen.asesores.length === 0 && <p className="text-xs text-bosque/50">Todavía no tenés asesores afiliados.</p>}
            {resumen.asesores.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs uppercase text-bosque/50">
                      <th className="py-1 pr-2">#</th>
                      <th className="py-1 pr-2">Asesor</th>
                      <th className="py-1 pr-2">Código</th>
                      <th className="py-1 pr-2">Distrito</th>
                      <th className="py-1 pr-2 text-right">Vendido</th>
                      <th className="py-1 pr-2 text-right">Su comisión</th>
                      <th className="py-1 pr-2 text-right">Pedidos</th>
                      <th className="py-1 pr-2">Premio del mes</th>
                      <th className="py-1"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {resumen.asesores.map((a, i) => (
                      <Fragment key={a.asesorId}>
                        <tr className="border-t border-musgo/10">
                          <td className="py-1.5 pr-2 text-bosque/50">{i + 1}</td>
                          <td className="py-1.5 pr-2 font-medium text-bosque">{a.nombre}</td>
                          <td className="py-1.5 pr-2 text-bosque/60">{a.codigo}</td>
                          <td className="py-1.5 pr-2 text-bosque/60">{a.distrito ?? '—'}</td>
                          <td className="py-1.5 pr-2 text-right">{formatoSoles(a.totalVentaPvp)}</td>
                          <td className="py-1.5 pr-2 text-right">{formatoSoles(a.comisionAsesor)}</td>
                          <td className="py-1.5 pr-2 text-right">{a.cantidadPedidos}</td>
                          <td className="py-1.5 pr-2 text-xs">
                            {a.premioActual && <span className="font-medium text-acento">{a.premioActual}</span>}
                            {a.premioSiguiente && (
                              <span className="text-bosque/50">
                                {a.premioActual ? ' · ' : ''}faltan {formatoSoles(a.faltantePremio ?? 0)} para {a.premioSiguiente}
                              </span>
                            )}
                            {!a.premioActual && !a.premioSiguiente && <span className="text-bosque/40">Sin escala activa</span>}
                          </td>
                          <td className="py-1.5 text-right">
                            <button
                              onClick={() => setAsesorExpandido(asesorExpandido === a.asesorId ? null : a.asesorId)}
                              className="text-xs text-acento underline"
                            >
                              {asesorExpandido === a.asesorId ? 'Ocultar' : 'Ver histórico'}
                            </button>
                          </td>
                        </tr>
                        {asesorExpandido === a.asesorId && (
                          <tr className="border-t border-musgo/10 bg-crema/40">
                            <td colSpan={9} className="p-2">
                              <SerieMensualAsesor asesorId={a.asesorId} />
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// Histórico mensual de venta de un asesor puntual — drill-down desde la fila
// del ranking. Mismo endpoint que usa el propio asesor en Carrito, visto
// acá desde el lado del Líder (backend valida que sea de su equipo).
function SerieMensualAsesor({ asesorId }: { asesorId: string }) {
  const [serie, setSerie] = useState<SeriePremio | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setSerie(null);
    setError(null);
    apiFetch<SeriePremio>(`/premios/asesor/${asesorId}/serie?meses=6`)
      .then(setSerie)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'No se pudo cargar el histórico.'));
  }, [asesorId]);

  if (error) return <p className="text-xs text-bosque/50">{error}</p>;
  if (!serie) return <p className="text-xs text-bosque/40">Cargando…</p>;

  return (
    <ResponsiveContainer width="100%" height={140}>
      <BarChart data={serie.puntos} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#1F4A2E" strokeOpacity={0.08} />
        <XAxis dataKey="etiqueta" tick={{ fontSize: 10, fill: '#1F4A2E' }} />
        <YAxis tick={{ fontSize: 10, fill: '#1F4A2E' }} width={50} tickFormatter={(v: number) => `S/${v}`} />
        <Tooltip
          formatter={(valor: number) => formatoSolesPremios(valor)}
          labelFormatter={(_, payload) => payload?.[0]?.payload?.nivelActual ?? ''}
        />
        <Bar dataKey="venta" name="Vendido" fill="#1F4A2E" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
