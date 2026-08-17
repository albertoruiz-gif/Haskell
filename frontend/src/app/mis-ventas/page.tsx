'use client';

// "Mis Ventas" — pantalla separada del Carrito (RF 2026-08-07: el asesor
// necesita revisar su desempeño sin mezclarlo con el checkout). Comisión
// semana/mes/total, historial de pedidos mes a mes, y productos más
// vendidos propios.

import { Fragment, useEffect, useState } from 'react';
import { apiFetch, ApiError } from '../../lib/api';
import { formatoSoles } from '../../lib/premios';
import { formatearNumeroPedido } from '../../lib/numeroPedido';
import { ErrorBanner } from '../../components/ui/ErrorBanner';
import { ProductosTopPie } from '../../components/ui/ProductosTopPie';
import { SerieHistoricaChart } from '../../components/indicadores/SerieHistoricaChart';
import { PERIODOS } from '../../lib/indicadores';
import type { Periodo } from '../../lib/indicadores';

type Pedido = { id: string; numero: number; canal: string; fecha: string; monto: number; comision: number; cantidadItems: number };
type Mes = { etiqueta: string; totalVenta: number; comisionMes: number; pedidos: Pedido[] };
type HistorialVentas = { comisionSemana: number; comisionMes: number; comisionTotal: number; canal: string; meses: Mes[] };

// EP-12 — seguimiento de un pedido (GET /orders/:id/seguimiento).
type Seguimiento = {
  referenciaWeb: string;
  numero: string;
  estado: string;
  estadoLabel: string;
  fechaEntregaPrometida: string | null;
  entrega: {
    estado: string;
    estadoLabel: string;
    transportistaNombre: string;
    fechaReprogramada: string | null;
    motivoFallo: string | null;
    receptor: string | null;
  } | null;
};

export default function MisVentasPage() {
  const [data, setData] = useState<HistorialVentas | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mesAbierto, setMesAbierto] = useState<string | null>(null);
  const [periodo, setPeriodo] = useState<Periodo>('Mes');
  // EP-12 — seguimiento del pedido, cargado bajo demanda al abrir la fila.
  const [pedidoAbierto, setPedidoAbierto] = useState<string | null>(null);
  const [seguimientos, setSeguimientos] = useState<Record<string, Seguimiento>>({});
  const [cargandoSeguimiento, setCargandoSeguimiento] = useState<string | null>(null);

  async function verSeguimiento(pedidoId: string) {
    if (pedidoAbierto === pedidoId) {
      setPedidoAbierto(null);
      return;
    }
    setPedidoAbierto(pedidoId);
    if (seguimientos[pedidoId]) return;
    setCargandoSeguimiento(pedidoId);
    try {
      const data = await apiFetch<Seguimiento>(`/orders/${pedidoId}/seguimiento`);
      setSeguimientos((s) => ({ ...s, [pedidoId]: data }));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo cargar el seguimiento del pedido.');
    } finally {
      setCargandoSeguimiento(null);
    }
  }

  useEffect(() => {
    apiFetch<HistorialVentas>('/premios/mi-historial-ventas')
      .then((d) => {
        setData(d);
        if (d.meses[0]) setMesAbierto(d.meses[0].etiqueta);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'No se pudo cargar tu historial de ventas.'));
  }, []);

  return (
    <div className="space-y-3">
      <h1 className="text-lg font-medium text-bosque">Mis Ventas</h1>
      <ErrorBanner mensaje={error} />

      {data && (
        <>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <div className="rounded-card bg-white p-4 shadow-sm">
              <p className="text-xs font-medium uppercase text-bosque/60">Comisión esta semana</p>
              <p className="mt-1 text-2xl font-semibold text-bosque">{formatoSoles(data.comisionSemana)}</p>
            </div>
            <div className="rounded-card bg-white p-4 shadow-sm">
              <p className="text-xs font-medium uppercase text-bosque/60">Comisión este mes</p>
              <p className="mt-1 text-2xl font-semibold text-bosque">{formatoSoles(data.comisionMes)}</p>
            </div>
            <div className="rounded-card bg-white p-4 shadow-sm">
              <p className="text-xs font-medium uppercase text-bosque/60">Comisión acumulada total</p>
              <p className="mt-1 text-2xl font-semibold text-bosque">{formatoSoles(data.comisionTotal)}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-2 lg:grid-cols-[1fr_360px] lg:items-start">
            <div className="rounded-card bg-white p-3 shadow-sm">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-sm font-medium text-bosque">Tu corrida de ventas</p>
                <select
                  value={periodo}
                  onChange={(e) => setPeriodo(e.target.value as Periodo)}
                  className="rounded-pill border border-musgo/30 bg-white px-2 py-1 text-xs text-bosque"
                >
                  {PERIODOS.map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>
              <SerieHistoricaChart
                indicador="ventas_netas"
                periodo={periodo}
                cantidad={periodo === 'Mes' ? 6 : 10}
                endpoint="/indicadores/mi-serie"
              />
            </div>
            <ProductosTopPie endpoint="/indicadores/mis-productos-top" titulo="Tus productos más vendidos (mes)" />
          </div>

          <div className="rounded-card bg-white p-4 shadow-sm">
            <p className="mb-2 text-sm font-medium text-bosque">Historial mes a mes</p>
            {data.meses.length === 0 && <p className="text-xs text-bosque/50">Todavía no tenés pedidos pagados.</p>}
            <div className="space-y-2">
              {data.meses.map((m) => (
                <div key={m.etiqueta} className="rounded-card border border-musgo/10">
                  <button
                    onClick={() => setMesAbierto(mesAbierto === m.etiqueta ? null : m.etiqueta)}
                    className="flex w-full items-center justify-between px-3 py-2 text-left"
                  >
                    <span className="text-sm font-medium capitalize text-bosque">{m.etiqueta}</span>
                    <span className="text-xs text-bosque/60">
                      Vendido {formatoSoles(m.totalVenta)} · Comisión {formatoSoles(m.comisionMes)}
                    </span>
                  </button>
                  {mesAbierto === m.etiqueta && (
                    <div className="overflow-x-auto border-t border-musgo/10 p-2">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="text-left uppercase text-bosque/50">
                            <th className="py-1 pr-2">Pedido</th>
                            <th className="py-1 pr-2">Fecha</th>
                            <th className="py-1 pr-2 text-right">Artículos</th>
                            <th className="py-1 pr-2 text-right">Monto</th>
                            <th className="py-1 text-right">Comisión</th>
                          </tr>
                        </thead>
                        <tbody>
                          {m.pedidos.map((p) => {
                            const seguimiento = seguimientos[p.id];
                            const abierto = pedidoAbierto === p.id;
                            return (
                              <Fragment key={p.id}>
                                <tr
                                  onClick={() => verSeguimiento(p.id)}
                                  className="cursor-pointer border-t border-musgo/10 hover:bg-crema/40"
                                >
                                  <td className="py-1 pr-2 font-medium text-bosque underline decoration-dotted">
                                    {formatearNumeroPedido(p.canal, p.numero)}
                                  </td>
                                  <td className="py-1 pr-2 text-bosque/60">{new Date(p.fecha).toLocaleDateString('es-PE')}</td>
                                  <td className="py-1 pr-2 text-right">{p.cantidadItems}</td>
                                  <td className="py-1 pr-2 text-right">{formatoSoles(p.monto)}</td>
                                  <td className="py-1 text-right text-acento">{formatoSoles(p.comision)}</td>
                                </tr>
                                {abierto && (
                                  <tr className="border-t border-musgo/10 bg-crema/30">
                                    <td colSpan={5} className="px-2 py-2 text-xs text-bosque/70">
                                      {cargandoSeguimiento === p.id && <p>Cargando seguimiento…</p>}
                                      {seguimiento && (
                                        <div className="space-y-0.5">
                                          <p><span className="font-medium">Estado del pedido:</span> {seguimiento.estadoLabel}</p>
                                          {seguimiento.fechaEntregaPrometida && (
                                            <p><span className="font-medium">Entrega prometida:</span> {new Date(seguimiento.fechaEntregaPrometida).toLocaleDateString('es-PE', { weekday: 'long', day: '2-digit', month: '2-digit' })}</p>
                                          )}
                                          {seguimiento.entrega ? (
                                            <>
                                              <p><span className="font-medium">Transportista:</span> {seguimiento.entrega.transportistaNombre} — {seguimiento.entrega.estadoLabel}</p>
                                              {seguimiento.entrega.fechaReprogramada && (
                                                <p><span className="font-medium">Nueva fecha (reprogramada):</span> {new Date(seguimiento.entrega.fechaReprogramada).toLocaleDateString('es-PE')}</p>
                                              )}
                                              {seguimiento.entrega.motivoFallo && (
                                                <p><span className="font-medium">Motivo del último intento fallido:</span> {seguimiento.entrega.motivoFallo}</p>
                                              )}
                                              {seguimiento.entrega.receptor && (
                                                <p><span className="font-medium">Recibió:</span> {seguimiento.entrega.receptor}</p>
                                              )}
                                            </>
                                          ) : (
                                            <p>Todavía no se asignó transportista.</p>
                                          )}
                                        </div>
                                      )}
                                    </td>
                                  </tr>
                                )}
                              </Fragment>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
