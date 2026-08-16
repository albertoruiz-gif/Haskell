'use client';

// EP-01: pestaña "Permisos" de Gestión — hasta ahora qué rol podía hacer
// qué acción estaba fijo en decoradores @Roles() del código backend, y
// cambiarlo requería un deploy. Acá un ADMINISTRADOR puede redefinir, por
// endpoint, qué roles entran — sin tocar código. Si no se toca nada, el
// sistema se comporta exactamente igual que antes (ver RolesGuard).

import { useEffect, useState } from 'react';
import { apiFetch, ApiError } from '../../lib/api';
import { ErrorBanner } from '../ui/ErrorBanner';

const ROLES_DISPONIBLES = [
  'ADMINISTRADOR',
  'GERENTE_GENERAL',
  'GERENTE_COMERCIAL',
  'GESTOR_CATALOGO',
  'LIDER_MINORISTA',
  'VENDEDOR',
  'ASESOR',
  'ALMACEN',
  'TRANSPORTISTA',
  'FINANZAS',
] as const;

type PermisoItem = {
  clave: string;
  modulo: string;
  etiqueta: string;
  rolesPorDefecto: string[];
  rolesEfectivos: string[];
  personalizado: boolean;
};

export function PermisosTab() {
  const [items, setItems] = useState<PermisoItem[]>([]);
  const [seleccion, setSeleccion] = useState<Record<string, string[]>>({});
  const [error, setError] = useState<string | null>(null);
  const [guardandoClave, setGuardandoClave] = useState<string | null>(null);
  const [okClave, setOkClave] = useState<string | null>(null);

  async function cargar() {
    try {
      const data = await apiFetch<PermisoItem[]>('/permisos');
      setItems(data);
      setSeleccion(Object.fromEntries(data.map((i) => [i.clave, i.rolesEfectivos])));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo cargar la matriz de permisos.');
    }
  }

  useEffect(() => {
    cargar();
  }, []);

  function toggleRol(clave: string, rol: string) {
    setSeleccion((s) => {
      const actual = s[clave] ?? [];
      const nuevo = actual.includes(rol) ? actual.filter((r) => r !== rol) : [...actual, rol];
      return { ...s, [clave]: nuevo };
    });
  }

  async function guardar(clave: string) {
    setError(null);
    setGuardandoClave(clave);
    try {
      const roles = seleccion[clave] ?? [];
      const actualizado = await apiFetch<{ clave: string; rolesEfectivos: string[]; personalizado: boolean }>(
        `/permisos/${encodeURIComponent(clave)}`,
        { method: 'PATCH', body: { roles } },
      );
      setItems((its) => its.map((i) => (i.clave === clave ? { ...i, rolesEfectivos: actualizado.rolesEfectivos, personalizado: actualizado.personalizado } : i)));
      setOkClave(clave);
      setTimeout(() => setOkClave(null), 2000);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo guardar el permiso.');
    } finally {
      setGuardandoClave(null);
    }
  }

  async function restaurar(clave: string) {
    setError(null);
    setGuardandoClave(clave);
    try {
      const restaurado = await apiFetch<{ clave: string; rolesEfectivos: string[]; personalizado: boolean }>(
        `/permisos/${encodeURIComponent(clave)}`,
        { method: 'DELETE' },
      );
      setItems((its) => its.map((i) => (i.clave === clave ? { ...i, rolesEfectivos: restaurado.rolesEfectivos, personalizado: restaurado.personalizado } : i)));
      setSeleccion((s) => ({ ...s, [clave]: restaurado.rolesEfectivos }));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo restaurar el permiso.');
    } finally {
      setGuardandoClave(null);
    }
  }

  const modulos = Array.from(new Set(items.map((i) => i.modulo)));

  return (
    <div className="space-y-3">
      <p className="text-xs text-bosque/60">
        Qué rol puede hacer cada acción. Sin tocar nada acá, el sistema funciona igual que siempre — esto solo importa
        cuando querés ampliar o restringir un acceso puntual sin esperar un cambio de código.
      </p>
      <ErrorBanner mensaje={error} />

      {modulos.map((modulo) => {
        const filas = items.filter((i) => i.modulo === modulo);
        const personalizados = filas.filter((f) => f.personalizado).length;
        return (
          <details key={modulo} className="rounded-card bg-white p-3 shadow-sm" open={personalizados > 0}>
            <summary className="cursor-pointer text-sm font-medium text-bosque">
              {modulo}
              {personalizados > 0 && (
                <span className="ml-2 rounded-pill bg-promo px-1.5 py-0.5 text-[11px] font-semibold text-white">
                  {personalizados} personalizado{personalizados > 1 ? 's' : ''}
                </span>
              )}
            </summary>
            <div className="mt-2 overflow-x-auto">
              <table className="w-full min-w-[720px] text-xs">
                <thead>
                  <tr className="text-left text-bosque/50">
                    <th className="py-1 pr-3 font-medium">Acción</th>
                    {ROLES_DISPONIBLES.map((r) => (
                      <th key={r} className="px-1 py-1 text-center font-medium" title={r}>
                        {r.slice(0, 3)}
                      </th>
                    ))}
                    <th className="py-1 pl-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {filas.map((item) => {
                    const rolesFila = seleccion[item.clave] ?? item.rolesEfectivos;
                    const cambiado = JSON.stringify([...rolesFila].sort()) !== JSON.stringify([...item.rolesEfectivos].sort());
                    return (
                      <tr key={item.clave} className="border-t border-musgo/10">
                        <td className="py-1.5 pr-3 text-bosque">
                          {item.etiqueta}
                          {item.personalizado && <span className="ml-1 text-[10px] text-acento">·editado</span>}
                        </td>
                        {ROLES_DISPONIBLES.map((r) => (
                          <td key={r} className="px-1 text-center">
                            <input
                              type="checkbox"
                              checked={rolesFila.includes(r)}
                              onChange={() => toggleRol(item.clave, r)}
                            />
                          </td>
                        ))}
                        <td className="whitespace-nowrap py-1.5 pl-3 text-right">
                          {okClave === item.clave ? (
                            <span className="text-musgo-dark">✓ Guardado</span>
                          ) : (
                            <>
                              <button
                                onClick={() => guardar(item.clave)}
                                disabled={!cambiado || guardandoClave === item.clave}
                                className="rounded-pill bg-bosque px-2 py-1 text-white disabled:opacity-40"
                              >
                                Guardar
                              </button>
                              {item.personalizado && (
                                <button
                                  onClick={() => restaurar(item.clave)}
                                  disabled={guardandoClave === item.clave}
                                  title={`Volver al default: ${item.rolesPorDefecto.join(', ')}`}
                                  className="ml-1 rounded-pill bg-crema px-2 py-1 text-acento disabled:opacity-40"
                                >
                                  Restaurar
                                </button>
                              )}
                            </>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </details>
        );
      })}
      {items.length === 0 && !error && <p className="text-xs text-bosque/50">Cargando…</p>}
    </div>
  );
}
