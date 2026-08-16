'use client';

// EP-04 — bandeja de aprobación de descuento por volumen (GERENTE_COMERCIAL,
// GERENTE_GENERAL o ADMINISTRADOR). Decisión de negocio 2026-08-15: hasta 5%
// lo aprueba Gerencia Comercial; más de 5% requiere Gerencia General — el
// backend es quien de verdad lo exige (ClientesService.aprobarSolicitudDescuento),
// acá solo se avisa antes de intentarlo para no hacer clickear en vano.

import { useEffect, useState } from 'react';
import { apiFetch, ApiError } from '../../lib/api';
import { getUsuario } from '../../lib/auth';
import { ErrorBanner } from '../ui/ErrorBanner';

const UMBRAL_GERENTE_COMERCIAL = 5;

type Cliente = { id: string; razonSocialONombre: string; numeroDocumento: string; canal: string };

type Solicitud = {
  id: string;
  clienteId: string;
  cliente: Cliente;
  porcentaje: string;
  motivo: string | null;
  estado: string;
  createdAt: string;
};

export function DescuentosTab() {
  const rol = getUsuario()?.rol;
  const [solicitudes, setSolicitudes] = useState<Solicitud[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);

  async function cargar() {
    setCargando(true);
    try {
      const data = await apiFetch<Solicitud[]>('/solicitudes-descuento?estado=PENDIENTE');
      setSolicitudes(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo cargar las solicitudes de descuento.');
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    cargar();
  }, []);

  async function aprobar(id: string) {
    setError(null);
    try {
      await apiFetch(`/solicitudes-descuento/${id}/aprobar`, { method: 'PATCH' });
      await cargar();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo aprobar la solicitud.');
    }
  }

  async function rechazar(id: string) {
    setError(null);
    const motivoRechazo = prompt('Motivo del rechazo (opcional):') ?? undefined;
    try {
      await apiFetch(`/solicitudes-descuento/${id}/rechazar`, { method: 'PATCH', body: { motivoRechazo } });
      await cargar();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo rechazar la solicitud.');
    }
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-bosque/60">
        Descuento por volumen para clientes de Salón de Belleza y Retail — negociado por el Asesor con Gerencia Comercial, aprobación
        por pedido puntual (no queda vigente para compras futuras). Hasta 5% lo aprueba Gerencia Comercial; más de 5% requiere Gerencia General.
      </p>
      <ErrorBanner mensaje={error} />
      {cargando && <p className="text-xs text-bosque/50">Cargando…</p>}
      {!cargando && solicitudes.length === 0 && <p className="text-xs text-bosque/50">No hay solicitudes de descuento pendientes.</p>}

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {solicitudes.map((s) => {
          const porcentaje = Number(s.porcentaje);
          const requiereGerenteGeneral = porcentaje > UMBRAL_GERENTE_COMERCIAL;
          const puedeAprobar = rol === 'ADMINISTRADOR' || rol === 'GERENTE_GENERAL' || (rol === 'GERENTE_COMERCIAL' && !requiereGerenteGeneral);
          return (
            <div key={s.id} className="rounded-card bg-white p-3 shadow-sm">
              <p className="text-sm font-medium">{s.cliente.razonSocialONombre}</p>
              <p className="text-xs text-bosque/60">{s.cliente.numeroDocumento} · {s.cliente.canal}</p>
              <p className="mt-1 text-xs text-bosque/70">
                Solicita: <span className="font-medium">{porcentaje}%</span> de descuento
              </p>
              {s.motivo && <p className="mt-1 text-xs italic text-bosque/50">&ldquo;{s.motivo}&rdquo;</p>}
              {requiereGerenteGeneral && (
                <p className="mt-1 text-[11px] font-medium text-promo">Supera el 5% — requiere aprobación de Gerencia General.</p>
              )}

              <div className="mt-2 flex gap-2">
                <button
                  onClick={() => aprobar(s.id)}
                  disabled={!puedeAprobar}
                  title={!puedeAprobar ? 'Este descuento supera el 5% — solo Gerencia General o Administrador puede aprobarlo.' : undefined}
                  className="flex-1 rounded-pill bg-bosque py-2 text-xs font-medium text-white disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Aprobar
                </button>
                <button onClick={() => rechazar(s.id)} className="flex-1 rounded-pill bg-crema py-2 text-xs font-medium text-acento">
                  Rechazar
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
