'use client';

// EP-21 — solo se muestra en canales SALONES_BELLEZA/RETAIL (el checkout de
// carrito.tsx lo renderiza condicionalmente). Deja elegir a qué Cliente se
// le vende y cómo paga: Yape/Culqi (como hasta ahora), depósito bancario, o
// al crédito (solo si el cliente tiene línea aprobada y está ACTIVO).

import { useEffect, useState } from 'react';
import { apiFetch, ApiError } from '../../lib/api';

export type FormaPago = 'CONTADO_CULQI' | 'CONTADO_DEPOSITO' | 'AL_CREDITO';

type Cliente = {
  id: string;
  razonSocialONombre: string;
  estado: 'ACTIVO' | 'MOROSO' | 'BLOQUEADO';
  lineaCreditoAprobada: string | null;
  saldoUtilizado: string;
  // EP-04 — solo llegan acá las APROBADA-sin-usar (ver ClientesService.listar).
  solicitudesDescuento?: { id: string; porcentaje: string }[];
};

export function ClienteYFormaPagoSelector({
  clienteId,
  formaPago,
  solicitudDescuentoId,
  onCambiarCliente,
  onCambiarFormaPago,
  onCambiarDescuento,
  totalPedido,
}: {
  clienteId: string;
  formaPago: FormaPago;
  solicitudDescuentoId: string;
  onCambiarCliente: (id: string) => void;
  onCambiarFormaPago: (fp: FormaPago) => void;
  onCambiarDescuento: (id: string) => void;
  totalPedido: number;
}) {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    apiFetch<Cliente[]>('/clientes')
      .then(setClientes)
      .catch(() => setClientes([]))
      .finally(() => setCargando(false));
  }, []);

  const cliente = clientes.find((c) => c.id === clienteId);
  const cupoDisponible = cliente?.lineaCreditoAprobada != null ? Number(cliente.lineaCreditoAprobada) - Number(cliente.saldoUtilizado) : null;
  const puedeCredito = cliente?.estado === 'ACTIVO' && cupoDisponible !== null && cupoDisponible >= totalPedido;

  return (
    <div className="rounded-card bg-white p-3 shadow-sm">
      <p className="text-sm font-medium text-bosque">Cliente</p>
      {cargando ? (
        <p className="mt-1 text-xs text-bosque/50">Cargando tus clientes…</p>
      ) : clientes.length === 0 ? (
        <p className="mt-1 text-xs text-bosque/60">
          Todavía no diste de alta a ningún cliente — hacelo en{' '}
          <a href="/mis-clientes" className="font-medium text-acento underline">Mis clientes</a> antes de vender al crédito o por depósito.
        </p>
      ) : (
        <select
          value={clienteId}
          onChange={(e) => onCambiarCliente(e.target.value)}
          className="mt-1 w-full rounded-pill border border-musgo/30 px-3 py-2 text-sm"
        >
          <option value="">Sin cliente (venta directa por Yape)</option>
          {clientes.map((c) => (
            <option key={c.id} value={c.id}>{c.razonSocialONombre}</option>
          ))}
        </select>
      )}

      {cliente && (
        <p className="mt-1 text-xs text-bosque/60">
          {cliente.estado === 'MOROSO'
            ? 'Este cliente está moroso — solo puede pagar al contado.'
            : cupoDisponible !== null
              ? `Cupo de crédito disponible: S/ ${cupoDisponible.toFixed(2)}`
              : 'Este cliente todavía no tiene línea de crédito aprobada — solo puede pagar al contado.'}
        </p>
      )}

      {/* EP-04 — descuento por volumen ya aprobado para este cliente (uso único). */}
      {cliente && (cliente.solicitudesDescuento?.length ?? 0) > 0 && (
        <div className="mt-2">
          <p className="text-sm font-medium text-bosque">Descuento aprobado</p>
          <select
            value={solicitudDescuentoId}
            onChange={(e) => onCambiarDescuento(e.target.value)}
            className="mt-1 w-full rounded-pill border border-musgo/30 px-3 py-2 text-sm"
          >
            <option value="">Sin descuento</option>
            {cliente.solicitudesDescuento!.map((s) => (
              <option key={s.id} value={s.id}>{Number(s.porcentaje)}% de descuento</option>
            ))}
          </select>
        </div>
      )}

      <p className="mt-3 text-sm font-medium text-bosque">Forma de pago</p>
      <div className="mt-1 space-y-1">
        <label className="flex items-center gap-2 text-sm">
          <input type="radio" checked={formaPago === 'CONTADO_CULQI'} onChange={() => onCambiarFormaPago('CONTADO_CULQI')} />
          Yape (cargo automático, como hasta ahora)
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="radio"
            checked={formaPago === 'CONTADO_DEPOSITO'}
            disabled={!clienteId}
            onChange={() => onCambiarFormaPago('CONTADO_DEPOSITO')}
          />
          Depósito bancario del cliente {!clienteId && <span className="text-xs text-bosque/40">(elegí un cliente)</span>}
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="radio"
            checked={formaPago === 'AL_CREDITO'}
            disabled={!puedeCredito}
            onChange={() => onCambiarFormaPago('AL_CREDITO')}
          />
          Al crédito
          {clienteId && !puedeCredito && <span className="text-xs text-bosque/40">(sin cupo suficiente)</span>}
        </label>
      </div>
    </div>
  );
}
