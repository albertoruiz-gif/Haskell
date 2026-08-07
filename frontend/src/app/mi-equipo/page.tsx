'use client';

// Vista del Líder de equipo (rol LIDER_MINORISTA) — ranking de sus propios
// asesores por venta, la comisión de cada uno y la comisión propia del
// líder (comisionPct % del total vendido por su equipo). Pedido por
// Alberto 2026-08-06 como pestaña aparte del tablero gerencial (ese
// depende de Odoo y todavía no calcula nada real; esto sí es 100% real
// hoy, consume backend/src/modules/lideres/lideres.service.ts).

import { useEffect, useState } from 'react';
import { apiFetch, ApiError } from '../../lib/api';
import { getUsuario } from '../../lib/auth';
import { ErrorBanner } from '../../components/ui/ErrorBanner';

type ResumenAsesor = {
  asesorId: string;
  codigo: string;
  nombre: string;
  totalVentaPvp: number;
  comisionAsesor: number;
  cantidadPedidos: number;
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
                      <th className="py-1 pr-2 text-right">Vendido</th>
                      <th className="py-1 pr-2 text-right">Su comisión</th>
                      <th className="py-1 text-right">Pedidos</th>
                    </tr>
                  </thead>
                  <tbody>
                    {resumen.asesores.map((a, i) => (
                      <tr key={a.asesorId} className="border-t border-musgo/10">
                        <td className="py-1.5 pr-2 text-bosque/50">{i + 1}</td>
                        <td className="py-1.5 pr-2 font-medium text-bosque">{a.nombre}</td>
                        <td className="py-1.5 pr-2 text-bosque/60">{a.codigo}</td>
                        <td className="py-1.5 pr-2 text-right">{formatoSoles(a.totalVentaPvp)}</td>
                        <td className="py-1.5 pr-2 text-right">{formatoSoles(a.comisionAsesor)}</td>
                        <td className="py-1.5 text-right">{a.cantidadPedidos}</td>
                      </tr>
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
