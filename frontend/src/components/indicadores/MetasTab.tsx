'use client';

// Pestaña Metas — CRUD real (a diferencia del resto del tablero, esto no
// depende de Odoo: POST /metas ya funciona hoy). Solo editable para
// ADMINISTRADOR/GERENTE_GENERAL/GERENTE_COMERCIAL; FINANZAS ve en solo lectura.

import { useEffect, useState } from 'react';
import { apiFetch, ApiError } from '../../lib/api';
import { getUsuario } from '../../lib/auth';
import { ErrorBanner } from '../ui/ErrorBanner';
import {
  CANAL_LABEL,
  CANALES,
  CATEGORIAS_INDICADORES,
  INDICADORES_POR_CANAL,
  infoIndicador,
  UNIDAD_CORTA,
  type MetaIndicador,
} from '../../lib/indicadores';

const ROLES_EDITAN = ['ADMINISTRADOR', 'GERENTE_GENERAL', 'GERENTE_COMERCIAL'];

function FilaMeta({
  indicador,
  canal,
  metaExistente,
  puedeEditar,
  onGuardado,
}: {
  indicador: string;
  canal: string | null;
  metaExistente?: MetaIndicador;
  puedeEditar: boolean;
  onGuardado: () => void;
}) {
  const unidad = UNIDAD_CORTA[infoIndicador(indicador).unidad];
  const [valor, setValor] = useState(metaExistente?.valorObjetivo ?? '');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setValor(metaExistente?.valorObjetivo ?? '');
  }, [metaExistente?.valorObjetivo]);

  async function guardar() {
    const numero = Number(valor);
    if (!valor || Number.isNaN(numero)) {
      setError('Ingresá un número válido.');
      return;
    }
    setGuardando(true);
    setError(null);
    try {
      await apiFetch('/metas', { method: 'POST', body: { indicador, canal, valorObjetivo: numero } });
      onGuardado();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo guardar la meta.');
    } finally {
      setGuardando(false);
    }
  }

  return (
    <tr className="border-t border-musgo/10">
      <td className="py-1.5 pr-2 text-bosque/70">{canal ? CANAL_LABEL[canal] ?? canal : 'Global'}</td>
      <td className="py-1.5 pr-2">
        {puedeEditar ? (
          <span className="inline-flex items-center gap-1">
            <input
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              placeholder="sin meta definida"
              className="w-28 rounded-pill border border-musgo/30 px-2 py-1 text-sm"
            />
            <span className="text-xs text-bosque/50">{unidad}</span>
          </span>
        ) : (
          <span>{metaExistente ? `${metaExistente.valorObjetivo} ${unidad}` : 'sin meta definida'}</span>
        )}
      </td>
      <td className="py-1.5 pr-2 text-xs text-bosque/40">{metaExistente ? `#${metaExistente.actualizadoPorId.slice(0, 8)}` : '—'}</td>
      <td className="py-1.5">
        {puedeEditar && (
          <button onClick={guardar} disabled={guardando} className="rounded-pill bg-bosque px-3 py-1 text-xs font-medium text-white disabled:opacity-50">
            {guardando ? 'Guardando…' : 'Guardar'}
          </button>
        )}
        {error && <span className="ml-2 text-xs text-riesgo">{error}</span>}
      </td>
    </tr>
  );
}

export function MetasTab() {
  const [metas, setMetas] = useState<MetaIndicador[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);
  const usuario = getUsuario();
  const puedeEditar = usuario ? ROLES_EDITAN.includes(usuario.rol) : false;

  async function cargar() {
    setCargando(true);
    try {
      setMetas(await apiFetch<MetaIndicador[]>('/metas'));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudieron cargar las metas.');
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    cargar();
  }, []);

  return (
    <div className="space-y-4">
      <ErrorBanner mensaje={error} />
      {cargando && <p className="text-xs text-bosque/50">Cargando…</p>}
      {!puedeEditar && <p className="text-xs text-bosque/50">Estás viendo las metas en modo solo lectura.</p>}

      {CATEGORIAS_INDICADORES.map((categoria) => (
        <div key={categoria.label} className="rounded-card bg-white p-4 shadow-sm">
          <p className="mb-2 text-sm font-medium text-bosque">{categoria.label}</p>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase text-bosque/50">
                <th className="py-1 pr-2">Alcance</th>
                <th className="py-1 pr-2">Valor objetivo</th>
                <th className="py-1 pr-2">Actualizado por</th>
                <th className="py-1"></th>
              </tr>
            </thead>
            <tbody>
              {categoria.indicadores.map((indicador) => {
                const esPorCanal = INDICADORES_POR_CANAL.includes(indicador);
                const alcances: (string | null)[] = esPorCanal ? [...CANALES, null] : [null];
                return (
                  <>
                    <tr key={indicador}>
                      <td colSpan={4} className="pt-3 pb-1 text-xs font-semibold text-bosque">
                        {infoIndicador(indicador).label}{' '}
                        <span className="font-normal text-bosque/40">({UNIDAD_CORTA[infoIndicador(indicador).unidad]})</span>
                      </td>
                    </tr>
                    {alcances.map((canal) => (
                      <FilaMeta
                        key={`${indicador}-${canal}`}
                        indicador={indicador}
                        canal={canal}
                        metaExistente={metas.find((m) => m.indicador === indicador && m.canal === canal)}
                        puedeEditar={puedeEditar}
                        onGuardado={cargar}
                      />
                    ))}
                  </>
                );
              })}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}
