'use client';

// EP-21 — bandeja de validación de cobros (GERENTE_COMERCIAL/ADMINISTRADOR/
// FINANZAS): un cobro registrado por el Asesor no se aplica solo al saldo
// del cliente — queda PENDIENTE con su comprobante adjunto hasta que
// alguien de acá lo valide o lo rechace. Mismo patrón que CreditosTab.

import { useEffect, useState } from 'react';
import { apiFetch, ApiError, resolveAssetUrl } from '../../lib/api';
import { ErrorBanner } from '../ui/ErrorBanner';

type Cliente = { razonSocialONombre: string; numeroDocumento: string; canal: string };

type Cobro = {
  id: string;
  clienteId: string;
  cliente: Cliente;
  monto: string;
  metodo: string;
  numeroOperacion: string | null;
  banco: string | null;
  comprobanteUrl: string | null;
  observaciones: string | null;
  createdAt: string;
};

const METODO_LABEL: Record<string, string> = { deposito: 'Depósito', efectivo: 'Efectivo', culqi: 'Culqi' };

export function CobrosTab() {
  const [cobros, setCobros] = useState<Cobro[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);
  const [procesandoId, setProcesandoId] = useState<string | null>(null);

  async function cargar() {
    setCargando(true);
    try {
      const data = await apiFetch<Cobro[]>('/cobros?estado=PENDIENTE');
      setCobros(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo cargar los cobros pendientes.');
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    cargar();
  }, []);

  async function validar(id: string) {
    setError(null);
    setProcesandoId(id);
    try {
      await apiFetch(`/cobros/${id}/validar`, { method: 'PATCH' });
      await cargar();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo validar el cobro.');
    } finally {
      setProcesandoId(null);
    }
  }

  async function rechazar(id: string) {
    setError(null);
    const motivoRechazo = prompt('Motivo del rechazo (opcional):') ?? undefined;
    setProcesandoId(id);
    try {
      await apiFetch(`/cobros/${id}/rechazar`, { method: 'PATCH', body: { motivoRechazo } });
      await cargar();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo rechazar el cobro.');
    } finally {
      setProcesandoId(null);
    }
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-bosque/60">
        Cobros registrados por los Asesores contra la deuda de sus clientes — recién se descuentan del saldo cuando se validan acá.
      </p>
      <ErrorBanner mensaje={error} />
      {cargando && <p className="text-xs text-bosque/50">Cargando…</p>}
      {!cargando && cobros.length === 0 && <p className="text-xs text-bosque/50">No hay cobros pendientes de validar.</p>}

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {cobros.map((c) => (
          <div key={c.id} className="rounded-card bg-white p-3 shadow-sm">
            <p className="text-sm font-medium">{c.cliente.razonSocialONombre}</p>
            <p className="text-xs text-bosque/60">{c.cliente.numeroDocumento} · {c.cliente.canal}</p>
            <p className="mt-1 text-xs text-bosque/70">
              Monto: <span className="font-medium">S/ {Number(c.monto).toFixed(2)}</span> · {METODO_LABEL[c.metodo] ?? c.metodo}
            </p>
            {(c.numeroOperacion || c.banco) && (
              <p className="text-xs text-bosque/50">{c.banco ?? ''} {c.numeroOperacion ? `· Op. ${c.numeroOperacion}` : ''}</p>
            )}
            {c.comprobanteUrl ? (
              <a href={resolveAssetUrl(c.comprobanteUrl)} target="_blank" rel="noopener noreferrer" className="mt-1 inline-block text-xs font-medium text-acento underline">
                Ver comprobante
              </a>
            ) : (
              <p className="mt-1 text-xs text-red-600">Sin comprobante adjunto</p>
            )}

            <div className="mt-2 flex gap-2">
              <button
                onClick={() => validar(c.id)}
                disabled={procesandoId === c.id}
                className="flex-1 rounded-pill bg-bosque py-2 text-xs font-medium text-white disabled:opacity-50"
              >
                Validar
              </button>
              <button
                onClick={() => rechazar(c.id)}
                disabled={procesandoId === c.id}
                className="flex-1 rounded-pill bg-crema py-2 text-xs font-medium text-acento disabled:opacity-50"
              >
                Rechazar
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
