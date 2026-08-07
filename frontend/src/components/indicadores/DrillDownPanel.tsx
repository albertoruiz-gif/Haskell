'use client';

import { useState } from 'react';
import { calcularEstado, ESTADO_LABEL, ESTADO_TEXTO, formatearValor, infoIndicador, PERIODOS } from '../../lib/indicadores';
import type { ValorIndicador } from '../../lib/indicadores';
import { SerieHistoricaChart } from './SerieHistoricaChart';

type FilaSeguimiento = {
  id: string;
  numeroSemana: string;
  problemaCausa: string;
  accionesCorrectivas: string;
  fechaSolucion: string;
  responsable: string;
  estado: 'Pendiente' | 'Concluido';
};

// Tabla de seguimiento — solo UI por ahora (RN pedido explícito del prompt:
// no hay tabla en Postgres para esto todavía, si se necesita que persista
// hay que diseñarla aparte).
function TablaSeguimiento() {
  const [filas, setFilas] = useState<FilaSeguimiento[]>([]);

  function agregarFila() {
    setFilas((prev) => [
      { id: crypto.randomUUID(), numeroSemana: '', problemaCausa: '', accionesCorrectivas: '', fechaSolucion: '', responsable: '', estado: 'Pendiente' },
      ...prev,
    ]);
  }

  function actualizarFila(id: string, cambios: Partial<FilaSeguimiento>) {
    setFilas((prev) => prev.map((f) => (f.id === id ? { ...f, ...cambios } : f)));
  }

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <p className="text-sm font-medium text-bosque">Seguimiento</p>
        <button onClick={agregarFila} className="rounded-pill bg-bosque px-3 py-1.5 text-xs font-medium text-white">
          Agregar fila
        </button>
      </div>
      <div className="max-h-40 overflow-y-auto rounded-card border border-musgo/15">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-crema">
            <tr className="text-left uppercase text-bosque/50">
              <th className="p-2">N° Semana</th>
              <th className="p-2">Problema / causa</th>
              <th className="p-2">Acciones correctivas</th>
              <th className="p-2">Fecha de solución</th>
              <th className="p-2">Responsable</th>
              <th className="p-2">Estado</th>
            </tr>
          </thead>
          <tbody>
            {filas.length === 0 && (
              <tr>
                <td colSpan={6} className="p-3 text-center text-bosque/40">
                  Sin filas todavía.
                </td>
              </tr>
            )}
            {filas.map((f) => (
              <tr key={f.id} className="border-t border-musgo/10">
                <td className="p-1">
                  <input
                    type="number"
                    min={1}
                    max={53}
                    value={f.numeroSemana}
                    onChange={(e) => actualizarFila(f.id, { numeroSemana: e.target.value })}
                    className="w-14 rounded bg-transparent p-1 outline-none focus:bg-white"
                  />
                </td>
                <td className="p-1">
                  <input
                    value={f.problemaCausa}
                    onChange={(e) => actualizarFila(f.id, { problemaCausa: e.target.value })}
                    className="w-full rounded bg-transparent p-1 outline-none focus:bg-white"
                  />
                </td>
                <td className="p-1">
                  <input
                    value={f.accionesCorrectivas}
                    onChange={(e) => actualizarFila(f.id, { accionesCorrectivas: e.target.value })}
                    className="w-full rounded bg-transparent p-1 outline-none focus:bg-white"
                  />
                </td>
                <td className="p-1">
                  <input
                    type="date"
                    value={f.fechaSolucion}
                    onChange={(e) => actualizarFila(f.id, { fechaSolucion: e.target.value })}
                    className="w-full rounded bg-transparent p-1 outline-none focus:bg-white"
                  />
                </td>
                <td className="p-1">
                  <input
                    value={f.responsable}
                    onChange={(e) => actualizarFila(f.id, { responsable: e.target.value })}
                    className="w-full rounded bg-transparent p-1 outline-none focus:bg-white"
                  />
                </td>
                <td className="p-1">
                  <select
                    value={f.estado}
                    onChange={(e) => actualizarFila(f.id, { estado: e.target.value as FilaSeguimiento['estado'] })}
                    className={`rounded-pill px-2 py-1 text-xs font-medium ${
                      f.estado === 'Concluido' ? 'bg-exito/15 text-exito' : 'bg-alerta/15 text-alerta'
                    }`}
                  >
                    <option value="Pendiente">Pendiente</option>
                    <option value="Concluido">Concluido</option>
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function DrillDownPanel({ dato, onClose }: { dato: ValorIndicador; onClose: () => void }) {
  const [periodo, setPeriodo] = useState<(typeof PERIODOS)[number]>('Mes');
  const info = infoIndicador(dato.indicador);
  const estado = calcularEstado(dato.valorActual, dato.meta, info.menorEsMejor);

  return (
    <div className="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-bosque/20 p-3 pt-8">
      <div className="w-full max-w-3xl space-y-4 rounded-card bg-white p-4 shadow-lg">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-medium uppercase text-bosque/60">{info.label}</p>
            <p className="text-2xl font-semibold text-bosque">{formatearValor(dato.valorActual, info.unidad)}</p>
            <p className={`text-xs font-medium ${ESTADO_TEXTO[estado]}`}>
              {ESTADO_LABEL[estado]}
              {dato.meta !== null && <span className="text-bosque/40"> · meta {formatearValor(dato.meta, info.unidad)}</span>}
            </p>
          </div>
          <button onClick={onClose} className="rounded-pill bg-crema px-3 py-1.5 text-xs font-medium text-bosque">
            Cerrar
          </button>
        </div>

        <div className="flex flex-wrap gap-1">
          {PERIODOS.map((p) => (
            <button
              key={p}
              onClick={() => setPeriodo(p)}
              className={
                periodo === p
                  ? 'rounded-pill bg-acento px-3 py-1 text-xs font-medium text-white'
                  : 'rounded-pill bg-crema px-3 py-1 text-xs text-bosque'
              }
            >
              {p}
            </button>
          ))}
        </div>

        <SerieHistoricaChart indicador={dato.indicador} periodo={periodo} />

        <TablaSeguimiento />
      </div>
    </div>
  );
}
