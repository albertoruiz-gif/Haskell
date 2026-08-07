'use client';

// "Mis Ventas" — pantalla separada del Carrito (RF 2026-08-07: el asesor
// necesita revisar su desempeño sin mezclarlo con el checkout). Comisión
// semana/mes/total, historial de pedidos mes a mes, y productos más
// vendidos propios.

import { useEffect, useState } from 'react';
import { apiFetch, ApiError } from '../../lib/api';
import { formatoSoles } from '../../lib/premios';
import { formatearNumeroPedido } from '../../lib/numeroPedido';
import { ErrorBanner } from '../../components/ui/ErrorBanner';
import { ProductosTopPie } from '../../components/ui/ProductosTopPie';

type Pedido = { numero: number; canal: string; fecha: string; monto: number; comision: number; cantidadItems: number };
type Mes = { etiqueta: string; totalVenta: number; comisionMes: number; pedidos: Pedido[] };
type HistorialVentas = { comisionSemana: number; comisionMes: number; comisionTotal: number; canal: string; meses: Mes[] };

export default function MisVentasPage() {
  const [data, setData] = useState<HistorialVentas | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mesAbierto, setMesAbierto] = useState<string | null>(null);

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

          <ProductosTopPie endpoint="/indicadores/mis-productos-top" titulo="Tus productos más vendidos (mes actual)" />

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
                          {m.pedidos.map((p) => (
                            <tr key={p.numero} className="border-t border-musgo/10">
                              <td className="py-1 pr-2 font-medium text-bosque">{formatearNumeroPedido(p.canal, p.numero)}</td>
                              <td className="py-1 pr-2 text-bosque/60">{new Date(p.fecha).toLocaleDateString('es-PE')}</td>
                              <td className="py-1 pr-2 text-right">{p.cantidadItems}</td>
                              <td className="py-1 pr-2 text-right">{formatoSoles(p.monto)}</td>
                              <td className="py-1 text-right text-acento">{formatoSoles(p.comision)}</td>
                            </tr>
                          ))}
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
