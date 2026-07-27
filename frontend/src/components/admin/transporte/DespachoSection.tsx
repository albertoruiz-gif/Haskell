'use client';

// Seguimiento del transportista, en formato tabla (una fila por pedido,
// todos los estados visibles a la vez): asignar (sobre pedidos ya
// empacados en Almacén), aceptar, en tránsito, entregado/devuelto — con
// el plazo de entrega (RF-030, slaHorasSnapshot del pedido, 36h por
// defecto) y una clasificación de salud (Atrasado / A tiempo / Postergado).

import { Fragment, useEffect, useState } from 'react';
import { apiFetch, ApiError, resolveAssetUrl } from '../../../lib/api';

type Entrega = {
  estado: 'ASIGNADO' | 'ACEPTADO' | 'EN_RUTA' | 'ENTREGADO' | 'FALLIDO';
  transportistaId: string;
  motivoFallo: string | null;
  receptor: string | null;
  documentoReceptor: string | null;
  evidenciaUrl: string | null;
  updatedAt: string;
};

type Pedido = {
  id: string;
  referenciaWeb: string;
  estado: string;
  direccionSnapshot: { distrito?: string };
  asesor: { user: { nombre: string } };
  pagadoEn: string | null;
  slaHorasSnapshot: number | null;
  entrega: Entrega | null;
};

type Transportista = { id: string; user: { nombre: string } };

const MOTIVOS_DEVOLUCION = [
  'Cliente ausente',
  'No es el producto pedido',
  'El cliente ya no lo pidió',
  'Mala calidad / producto dañado',
  'Dirección incorrecta',
  'Otro',
];

function limiteSLA(p: Pedido): Date | null {
  if (!p.pagadoEn || !p.slaHorasSnapshot) return null;
  return new Date(new Date(p.pagadoEn).getTime() + p.slaHorasSnapshot * 60 * 60 * 1000);
}

function horasTranscurridas(p: Pedido): number | null {
  if (!p.pagadoEn) return null;
  const hasta = p.entrega?.estado === 'ENTREGADO' || p.entrega?.estado === 'FALLIDO' ? new Date(p.entrega.updatedAt) : new Date();
  return (hasta.getTime() - new Date(p.pagadoEn).getTime()) / 3_600_000;
}

type EstadoSalud = 'Atrasado' | 'A tiempo' | 'Postergado';

function calcularEstadoSalud(p: Pedido): EstadoSalud | null {
  if (p.entrega?.estado === 'FALLIDO') return 'Postergado';
  const limite = limiteSLA(p);
  if (!limite) return null;
  if (p.entrega?.estado === 'ENTREGADO') {
    return new Date(p.entrega.updatedAt).getTime() <= limite.getTime() ? 'A tiempo' : 'Atrasado';
  }
  return Date.now() <= limite.getTime() ? 'A tiempo' : 'Atrasado';
}

const COLOR_ESTADO_SALUD: Record<EstadoSalud, string> = {
  'A tiempo': 'bg-musgo/20 text-musgo-dark',
  Atrasado: 'bg-red-100 text-red-700',
  Postergado: 'bg-promo/20 text-promo',
};

export function DespachoSection() {
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [transportistas, setTransportistas] = useState<Transportista[]>([]);
  const [asignando, setAsignando] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);
  const [procesando, setProcesando] = useState(false);
  const [receptor, setReceptor] = useState('');
  const [documentoReceptor, setDocumentoReceptor] = useState('');
  const [fotoEvidencia, setFotoEvidencia] = useState<File | null>(null);
  const [motivoDevolucion, setMotivoDevolucion] = useState(MOTIVOS_DEVOLUCION[0]);
  const [observaciones, setObservaciones] = useState('');
  const [accionEntrega, setAccionEntrega] = useState<{ id: string; tipo: 'entregar' | 'devolver' } | null>(null);
  const [, forceTick] = useState(0); // refresca "tiempo transcurrido" cada minuto sin recargar del servidor

  async function cargar() {
    setCargando(true);
    setError(null);
    try {
      // El estado del pedido solo cambia a ENTREGADO_TRANSPORTISTA cuando el
      // transportista ACEPTA — mientras está "asignado pero no aceptado"
      // sigue en PACKING, así que ese matiz se distingue por entrega.estado,
      // no por el estado del pedido (ver columna Transportista más abajo).
      const [packing, aceptado, enRuta, entregado, fallido] = await Promise.all([
        apiFetch<Pedido[]>('/orders?estado=PACKING'),
        apiFetch<Pedido[]>('/orders?estado=ENTREGADO_TRANSPORTISTA'),
        apiFetch<Pedido[]>('/orders?estado=EN_RUTA'),
        apiFetch<Pedido[]>('/orders?estado=ENTREGADO'),
        apiFetch<Pedido[]>('/orders?estado=ENTREGA_FALLIDA'),
      ]);
      const combinados = [...packing, ...aceptado, ...enRuta, ...entregado, ...fallido];
      const sinDuplicados = Array.from(new Map(combinados.map((p) => [p.id, p])).values());
      setPedidos(sinDuplicados);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo cargar los pedidos.');
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    cargar();
    apiFetch<Transportista[]>('/transportistas').then(setTransportistas).catch(() => setTransportistas([]));
    const t = setInterval(() => forceTick((n) => n + 1), 60_000);
    return () => clearInterval(t);
  }, []);

  async function asignar(p: Pedido) {
    const transportistaId = asignando[p.id];
    if (!transportistaId) return;
    setProcesando(true);
    setError(null);
    try {
      await apiFetch(`/operaciones/pedidos/${p.id}/transportista/asignar`, { method: 'POST', body: { transportistaId, bultos: 1 } });
      await cargar();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo asignar el transportista.');
    } finally {
      setProcesando(false);
    }
  }

  async function accion(p: Pedido, tipo: 'aceptar' | 'en-ruta') {
    setError(null);
    setProcesando(true);
    try {
      await apiFetch(`/operaciones/pedidos/${p.id}/transportista/${tipo}`, { method: 'POST' });
      await cargar();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo actualizar el despacho.');
    } finally {
      setProcesando(false);
    }
  }

  async function confirmarEntregaFinal(p: Pedido) {
    if (!receptor.trim()) {
      setError('Ingresá quién recibió el pedido.');
      return;
    }
    if (!documentoReceptor.trim()) {
      setError('Ingresá el DNI de quién recibió.');
      return;
    }
    if (!fotoEvidencia) {
      setError('Subí una foto de evidencia de la entrega.');
      return;
    }
    setError(null);
    setProcesando(true);
    try {
      const formData = new FormData();
      formData.append('receptor', receptor);
      formData.append('documentoReceptor', documentoReceptor);
      formData.append('foto', fotoEvidencia);
      await apiFetch(`/operaciones/pedidos/${p.id}/entrega/confirmar`, { method: 'POST', body: formData, isFormData: true });
      await cargar();
      setAccionEntrega(null);
      setReceptor('');
      setDocumentoReceptor('');
      setFotoEvidencia(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo confirmar la entrega.');
    } finally {
      setProcesando(false);
    }
  }

  async function marcarDevuelto(p: Pedido) {
    setError(null);
    setProcesando(true);
    try {
      await apiFetch(`/operaciones/pedidos/${p.id}/entrega/fallida`, {
        method: 'POST',
        body: { motivo: motivoDevolucion, observaciones: observaciones || undefined },
      });
      await cargar();
      setAccionEntrega(null);
      setObservaciones('');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo registrar la devolución.');
    } finally {
      setProcesando(false);
    }
  }

  // Orden: primero lo que necesita accion (por asignar, en curso), historial al final.
  const ordenPeso: Record<string, number> = { PACKING: 0, ENTREGADO_TRANSPORTISTA: 1, EN_RUTA: 1, ENTREGADO: 2, ENTREGA_FALLIDA: 2 };
  const filas = [...pedidos].sort((a, b) => (ordenPeso[a.estado] ?? 9) - (ordenPeso[b.estado] ?? 9));

  return (
    <div className="space-y-3">
      {error && <p className="text-xs text-red-600">{error}</p>}
      {cargando && <p className="text-xs text-bosque/50">Cargando…</p>}
      {!cargando && filas.length === 0 && <p className="text-xs text-bosque/50">No hay pedidos empacados ni en despacho todavía.</p>}

      {filas.length > 0 && (
        <div className="overflow-x-auto rounded-card bg-white shadow-sm">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead>
              <tr className="border-b border-musgo/10 text-xs uppercase text-bosque/50">
                <th className="px-3 py-2 font-medium">Pedido</th>
                <th className="px-3 py-2 font-medium">Transportista</th>
                <th className="px-3 py-2 font-medium">En tránsito</th>
                <th className="px-3 py-2 font-medium">Tiempo transcurrido</th>
                <th className="px-3 py-2 font-medium">Entregado</th>
                <th className="px-3 py-2 font-medium">Devuelto (causa)</th>
                <th className="px-3 py-2 font-medium">Estado</th>
                <th className="px-3 py-2 font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filas.map((p) => {
                const transportista = transportistas.find((t) => t.id === p.entrega?.transportistaId);
                const horas = horasTranscurridas(p);
                const estadoSalud = calcularEstadoSalud(p);
                const mostrandoAccion = accionEntrega?.id === p.id;
                const sinAsignar = !p.entrega;

                return (
                  <Fragment key={p.id}>
                    <tr className="border-b border-musgo/10 align-top last:border-0">
                      <td className="px-3 py-2">
                        <p className="font-medium text-bosque">{p.referenciaWeb}</p>
                        <p className="text-xs text-bosque/60">{p.asesor.user.nombre} · {p.direccionSnapshot?.distrito ?? 'Sin distrito'}</p>
                      </td>
                      <td className="px-3 py-2">
                        {sinAsignar ? (
                          <div className="flex gap-1">
                            <select
                              value={asignando[p.id] ?? ''}
                              onChange={(e) => setAsignando((s) => ({ ...s, [p.id]: e.target.value }))}
                              className="rounded-pill border border-musgo/30 px-2 py-1 text-xs"
                            >
                              <option value="">Pendiente…</option>
                              {transportistas.map((t) => <option key={t.id} value={t.id}>{t.user.nombre}</option>)}
                            </select>
                            <button
                              onClick={() => asignar(p)}
                              disabled={!asignando[p.id] || procesando}
                              className="rounded-pill bg-bosque px-3 py-1 text-xs font-medium text-white disabled:opacity-60"
                            >
                              Asignar
                            </button>
                          </div>
                        ) : (
                          <span>{transportista?.user.nombre ?? '—'}</span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        {p.entrega?.estado === 'EN_RUTA' || p.entrega?.estado === 'ENTREGADO' ? '✓' : '—'}
                      </td>
                      <td className="px-3 py-2">
                        {horas !== null ? `${horas.toFixed(1)}h${p.slaHorasSnapshot ? ` / ${p.slaHorasSnapshot}h` : ''}` : '—'}
                      </td>
                      <td className="px-3 py-2">
                        {p.entrega?.estado === 'ENTREGADO' ? (
                          <div>
                            <p>✓ {new Date(p.entrega.updatedAt).toLocaleString('es-PE')}</p>
                            <p className="text-xs text-bosque/50">
                              {p.entrega.receptor} · DNI {p.entrega.documentoReceptor ?? '—'}
                              {p.entrega.evidenciaUrl && (
                                <>
                                  {' · '}
                                  <a href={resolveAssetUrl(p.entrega.evidenciaUrl)} target="_blank" rel="noreferrer" className="text-acento underline">
                                    ver foto
                                  </a>
                                </>
                              )}
                            </p>
                          </div>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="px-3 py-2">
                        {p.entrega?.estado === 'FALLIDO' ? p.entrega.motivoFallo ?? 'Sin motivo registrado' : '—'}
                      </td>
                      <td className="px-3 py-2">
                        {estadoSalud ? (
                          <span className={`rounded-pill px-2 py-1 text-xs font-medium ${COLOR_ESTADO_SALUD[estadoSalud]}`}>{estadoSalud}</span>
                        ) : (
                          <span className="text-xs text-bosque/40">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        {p.entrega?.estado === 'ASIGNADO' && (
                          <button onClick={() => accion(p, 'aceptar')} disabled={procesando} className="rounded-pill bg-bosque px-3 py-1 text-xs font-medium text-white disabled:opacity-60">
                            Confirmar recepción
                          </button>
                        )}
                        {p.entrega?.estado === 'ACEPTADO' && (
                          <button onClick={() => accion(p, 'en-ruta')} disabled={procesando} className="rounded-pill bg-bosque px-3 py-1 text-xs font-medium text-white disabled:opacity-60">
                            Marcar en tránsito
                          </button>
                        )}
                        {p.entrega?.estado === 'EN_RUTA' && !mostrandoAccion && (
                          <div className="flex gap-1">
                            <button onClick={() => setAccionEntrega({ id: p.id, tipo: 'entregar' })} className="rounded-pill bg-bosque px-3 py-1 text-xs font-medium text-white">
                              Entregar
                            </button>
                            <button onClick={() => setAccionEntrega({ id: p.id, tipo: 'devolver' })} className="rounded-pill bg-crema px-3 py-1 text-xs font-medium text-acento">
                              Devolver
                            </button>
                          </div>
                        )}
                        {(p.entrega?.estado === 'ENTREGADO' || p.entrega?.estado === 'FALLIDO') && (
                          <span className="text-xs text-bosque/40">Cerrado</span>
                        )}
                      </td>
                    </tr>
                    {mostrandoAccion && (
                      <tr className="border-b border-musgo/10 bg-crema/50">
                        <td colSpan={8} className="px-3 py-2">
                          {accionEntrega.tipo === 'entregar' ? (
                            <div className="flex flex-wrap items-center gap-2">
                              <input
                                placeholder="Nombre de quién recibió"
                                value={receptor}
                                onChange={(e) => setReceptor(e.target.value)}
                                className="rounded-pill border border-musgo/30 px-3 py-1.5 text-xs"
                              />
                              <input
                                placeholder="DNI de quién recibió"
                                value={documentoReceptor}
                                onChange={(e) => setDocumentoReceptor(e.target.value)}
                                className="w-32 rounded-pill border border-musgo/30 px-3 py-1.5 text-xs"
                              />
                              <label className="cursor-pointer rounded-pill bg-crema px-3 py-1.5 text-xs font-medium text-bosque">
                                {fotoEvidencia ? `📷 ${fotoEvidencia.name.slice(0, 16)}` : '📷 Tomar/subir foto'}
                                <input
                                  type="file"
                                  accept="image/*"
                                  capture="environment"
                                  className="hidden"
                                  onChange={(e) => setFotoEvidencia(e.target.files?.[0] ?? null)}
                                />
                              </label>
                              <button onClick={() => confirmarEntregaFinal(p)} disabled={procesando} className="rounded-pill bg-bosque px-3 py-1.5 text-xs font-medium text-white disabled:opacity-60">
                                {procesando ? 'Confirmando…' : 'Confirmar entrega'}
                              </button>
                              <button
                                onClick={() => {
                                  setAccionEntrega(null);
                                  setReceptor('');
                                  setDocumentoReceptor('');
                                  setFotoEvidencia(null);
                                }}
                                className="rounded-pill bg-white px-3 py-1.5 text-xs text-bosque shadow-sm"
                              >
                                Cancelar
                              </button>
                            </div>
                          ) : (
                            <div className="flex flex-wrap items-center gap-2">
                              <select value={motivoDevolucion} onChange={(e) => setMotivoDevolucion(e.target.value)} className="rounded-pill border border-musgo/30 px-3 py-1.5 text-xs">
                                {MOTIVOS_DEVOLUCION.map((m) => <option key={m} value={m}>{m}</option>)}
                              </select>
                              <input
                                placeholder="Observaciones (opcional)"
                                value={observaciones}
                                onChange={(e) => setObservaciones(e.target.value)}
                                className="flex-1 rounded-pill border border-musgo/30 px-3 py-1.5 text-xs"
                              />
                              <button onClick={() => marcarDevuelto(p)} disabled={procesando} className="rounded-pill bg-acento px-3 py-1.5 text-xs font-medium text-white disabled:opacity-60">
                                Confirmar devolución
                              </button>
                              <button onClick={() => setAccionEntrega(null)} className="rounded-pill bg-white px-3 py-1.5 text-xs text-bosque shadow-sm">Cancelar</button>
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
  );
}
