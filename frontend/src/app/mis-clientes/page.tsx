'use client';

// EP-21 — el Asesor da de alta a sus propios clientes (el salón/tienda al
// que le vende, no el Asesor mismo) y les solicita línea de crédito a
// Gerencia Comercial. Solo tiene sentido en canales SALONES_BELLEZA/RETAIL
// — en COMERCIO_MINORISTA el Asesor compra para sí, no hay Cliente final.

import { useEffect, useState } from 'react';
import { apiFetch, ApiError } from '../../lib/api';
import { getUsuario } from '../../lib/auth';
import { ErrorBanner } from '../../components/ui/ErrorBanner';

type Cliente = {
  id: string;
  razonSocialONombre: string;
  tipoDocumento: string;
  numeroDocumento: string;
  telefono: string;
  estado: 'ACTIVO' | 'MOROSO' | 'BLOQUEADO';
  lineaCreditoAprobada: string | null;
  saldoUtilizado: string;
  solicitudesCredito?: { id: string; estado: string; lineaSolicitada: string }[];
};

const ESTADO_LABEL: Record<string, string> = { ACTIVO: 'Activo', MOROSO: 'Moroso — solo contado', BLOQUEADO: 'Bloqueado' };
const ESTADO_COLOR: Record<string, string> = {
  ACTIVO: 'bg-bosque text-white',
  MOROSO: 'bg-promo text-white',
  BLOQUEADO: 'bg-red-100 text-red-700',
};

const FORM_INICIAL = { razonSocialONombre: '', tipoDocumento: 'DNI', numeroDocumento: '', telefono: '', email: '', direccion: '' };

export default function MisClientesPage() {
  const canal = getUsuario()?.canal;
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [form, setForm] = useState(FORM_INICIAL);
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [montoSolicitud, setMontoSolicitud] = useState<Record<string, string>>({});

  const habilitado = canal === 'SALONES_BELLEZA' || canal === 'RETAIL';

  async function cargar() {
    try {
      const data = await apiFetch<Cliente[]>('/clientes');
      setClientes(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo cargar tus clientes.');
    }
  }

  useEffect(() => {
    if (habilitado) cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [habilitado]);

  function setCampo(campo: keyof typeof FORM_INICIAL, valor: string) {
    setForm((f) => ({ ...f, [campo]: valor }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setGuardando(true);
    try {
      await apiFetch('/clientes', { method: 'POST', body: form });
      setForm(FORM_INICIAL);
      await cargar();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo crear el cliente.');
    } finally {
      setGuardando(false);
    }
  }

  async function solicitarCredito(clienteId: string) {
    setError(null);
    const lineaSolicitada = Number(montoSolicitud[clienteId]);
    if (!lineaSolicitada || lineaSolicitada <= 0) {
      setError('Ingresá el monto de crédito que querés solicitar para este cliente.');
      return;
    }
    try {
      await apiFetch(`/clientes/${clienteId}/solicitudes-credito`, { method: 'POST', body: { lineaSolicitada } });
      setMontoSolicitud((m) => ({ ...m, [clienteId]: '' }));
      await cargar();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo enviar la solicitud de crédito.');
    }
  }

  if (!habilitado) {
    return (
      <div className="rounded-card bg-white p-4 text-sm text-bosque/60 shadow-sm">
        La gestión de clientes y línea de crédito solo aplica a los canales Salón de Belleza y Retail.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h1 className="text-lg font-medium text-bosque">Mis clientes</h1>
      <p className="text-xs text-bosque/60">
        Acá das de alta a tus clientes (el salón o tienda al que le vendés) y les pedís línea de crédito a Gerencia Comercial —
        mientras un cliente no tenga línea aprobada, sus pedidos se pagan al contado (depósito o Yape).
      </p>

      <div className="space-y-3 lg:grid lg:grid-cols-[360px_1fr] lg:items-start lg:gap-4 lg:space-y-0">
        <form onSubmit={onSubmit} className="space-y-2 rounded-card bg-white p-3 shadow-sm">
          <p className="text-sm font-medium text-bosque">Nuevo cliente</p>
          <input required placeholder="Razón social / Nombre" value={form.razonSocialONombre} onChange={(e) => setCampo('razonSocialONombre', e.target.value)} className="w-full rounded-pill border border-musgo/30 px-3 py-2 text-sm" />
          <div className="grid grid-cols-2 gap-2">
            <select value={form.tipoDocumento} onChange={(e) => setCampo('tipoDocumento', e.target.value)} className="rounded-pill border border-musgo/30 px-3 py-2 text-sm">
              <option value="DNI">DNI</option>
              <option value="RUC">RUC</option>
            </select>
            <input required placeholder="Número de documento" value={form.numeroDocumento} onChange={(e) => setCampo('numeroDocumento', e.target.value)} className="rounded-pill border border-musgo/30 px-3 py-2 text-sm" />
          </div>
          <input required placeholder="Teléfono" value={form.telefono} onChange={(e) => setCampo('telefono', e.target.value)} className="w-full rounded-pill border border-musgo/30 px-3 py-2 text-sm" />
          <input type="email" placeholder="Email (opcional)" value={form.email} onChange={(e) => setCampo('email', e.target.value)} className="w-full rounded-pill border border-musgo/30 px-3 py-2 text-sm" />
          <input placeholder="Dirección (opcional)" value={form.direccion} onChange={(e) => setCampo('direccion', e.target.value)} className="w-full rounded-pill border border-musgo/30 px-3 py-2 text-sm" />
          <ErrorBanner mensaje={error} />
          <button type="submit" disabled={guardando} className="w-full rounded-pill bg-bosque py-2 text-sm font-medium text-white disabled:opacity-60">
            {guardando ? 'Guardando…' : 'Crear cliente'}
          </button>
        </form>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {clientes.map((c) => {
            const lineaAprobada = c.lineaCreditoAprobada ? Number(c.lineaCreditoAprobada) : null;
            const disponible = lineaAprobada !== null ? lineaAprobada - Number(c.saldoUtilizado) : null;
            const tienePendiente = c.solicitudesCredito?.some((s) => s.estado === 'PENDIENTE');
            return (
              <div key={c.id} className="rounded-card bg-white p-3 shadow-sm">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-medium">{c.razonSocialONombre}</p>
                    <p className="text-xs text-bosque/60">{c.tipoDocumento} {c.numeroDocumento} · {c.telefono}</p>
                  </div>
                  <span className={`rounded-pill px-3 py-1 text-xs font-medium ${ESTADO_COLOR[c.estado]}`}>{ESTADO_LABEL[c.estado]}</span>
                </div>

                {lineaAprobada !== null ? (
                  <p className="mt-2 text-xs text-bosque/70">
                    Crédito: <span className="font-medium">S/ {disponible!.toFixed(2)}</span> disponible de S/ {lineaAprobada.toFixed(2)}
                  </p>
                ) : tienePendiente ? (
                  <p className="mt-2 text-xs text-promo">Solicitud de crédito enviada — esperando aprobación de Gerencia Comercial.</p>
                ) : (
                  <div className="mt-2 flex items-center gap-2">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="Monto a solicitar"
                      value={montoSolicitud[c.id] ?? ''}
                      onChange={(e) => setMontoSolicitud((m) => ({ ...m, [c.id]: e.target.value }))}
                      className="w-28 rounded-pill border border-musgo/30 px-2 py-1 text-xs"
                    />
                    <button onClick={() => solicitarCredito(c.id)} className="flex-1 rounded-pill bg-crema py-1.5 text-xs font-medium text-acento">
                      Solicitar crédito
                    </button>
                  </div>
                )}
              </div>
            );
          })}
          {clientes.length === 0 && <p className="text-xs text-bosque/50">Todavía no diste de alta ningún cliente.</p>}
        </div>
      </div>
    </div>
  );
}
