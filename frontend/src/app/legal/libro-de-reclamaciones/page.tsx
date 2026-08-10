'use client';

import { useState } from 'react';
import { apiFetch, ApiError } from '../../../lib/api';
import { ErrorBanner } from '../../../components/ui/ErrorBanner';

type TipoReclamo = 'RECLAMO' | 'QUEJA';

// Formulario público del Libro de Reclamaciones — obligación legal en Perú
// (DS 011-2011-PCM y normativa asociada), independiente de Culqi. Ver
// docs/PROMPT_culqi_requisitos_web.md: distingue Reclamo (disconformidad
// con el producto/servicio) de Queja (disconformidad con la atención) — son
// categorías legales distintas, no cosméticas.
export default function LibroReclamacionesPage() {
  const [tipo, setTipo] = useState<TipoReclamo>('RECLAMO');
  const [consumidorNombre, setConsumidorNombre] = useState('');
  const [consumidorTipoDocumento, setConsumidorTipoDocumento] = useState('DNI');
  const [consumidorNumeroDocumento, setConsumidorNumeroDocumento] = useState('');
  const [consumidorDomicilio, setConsumidorDomicilio] = useState('');
  const [consumidorTelefono, setConsumidorTelefono] = useState('');
  const [consumidorEmail, setConsumidorEmail] = useState('');
  const [bienOServicioReclamado, setBienOServicioReclamado] = useState('');
  const [montoReclamado, setMontoReclamado] = useState('');
  const [detalle, setDetalle] = useState('');
  const [pedidoConsumidor, setPedidoConsumidor] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [constancia, setConstancia] = useState<{ codigo: string; fecha: string } | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setEnviando(true);
    try {
      const data = await apiFetch<{ codigo: string; fecha: string }>('/libro-reclamaciones', {
        method: 'POST',
        body: {
          tipo,
          consumidorNombre,
          consumidorTipoDocumento,
          consumidorNumeroDocumento,
          consumidorDomicilio,
          consumidorTelefono,
          consumidorEmail,
          bienOServicioReclamado,
          montoReclamado: montoReclamado ? Number(montoReclamado) : undefined,
          detalle,
          pedidoConsumidor,
        },
      });
      setConstancia(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo registrar el reclamo. Probá de nuevo.');
    } finally {
      setEnviando(false);
    }
  }

  if (constancia) {
    return (
      <div className="mx-auto max-w-xl space-y-4 rounded-card bg-white p-5 shadow-sm">
        <h1 className="text-lg font-medium text-bosque">Reclamo registrado</h1>
        <p className="rounded-card bg-musgo/10 p-3 text-sm text-bosque/80">
          Guarda este código — es tu constancia. Podés consultar el estado de tu reclamo con él cuando quieras.
        </p>
        <div className="rounded-card border-2 border-dashed border-acento p-4 text-center">
          <p className="text-xs uppercase text-bosque/50">Código de constancia</p>
          <p className="mt-1 text-2xl font-medium text-bosque">{constancia.codigo}</p>
          <p className="mt-1 text-xs text-bosque/50">{new Date(constancia.fecha).toLocaleString('es-PE')}</p>
        </div>
        <button
          type="button"
          onClick={() => window.print()}
          className="w-full rounded-pill bg-bosque py-2 text-sm font-medium text-white"
        >
          Imprimir constancia
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <div className="rounded-card bg-white p-5 shadow-sm">
        <h1 className="text-lg font-medium text-bosque">Libro de Reclamaciones</h1>
        <p className="mt-2 text-xs text-bosque/60">
          Este establecimiento cuenta con un Libro de Reclamaciones a disposición del consumidor, conforme a lo
          establecido en el Código de Protección y Defensa del Consumidor.
        </p>
      </div>

      <form onSubmit={onSubmit} className="space-y-3 rounded-card bg-white p-5 shadow-sm">
        <div>
          <label className="text-xs font-medium uppercase text-bosque/60">Tipo</label>
          <div className="mt-1 flex gap-2">
            <button
              type="button"
              onClick={() => setTipo('RECLAMO')}
              className={`flex-1 rounded-pill py-2 text-sm font-medium ${tipo === 'RECLAMO' ? 'bg-acento text-white' : 'bg-crema text-bosque'}`}
            >
              Reclamo
            </button>
            <button
              type="button"
              onClick={() => setTipo('QUEJA')}
              className={`flex-1 rounded-pill py-2 text-sm font-medium ${tipo === 'QUEJA' ? 'bg-acento text-white' : 'bg-crema text-bosque'}`}
            >
              Queja
            </button>
          </div>
          <p className="mt-1 text-xs text-bosque/50">
            {tipo === 'RECLAMO'
              ? 'Reclamo: disconformidad con el producto o servicio.'
              : 'Queja: disconformidad con la atención recibida.'}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs font-medium uppercase text-bosque/60">Nombre completo</label>
            <input
              required
              value={consumidorNombre}
              onChange={(e) => setConsumidorNombre(e.target.value)}
              className="mt-1 w-full rounded-pill border border-musgo/30 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-xs font-medium uppercase text-bosque/60">Documento</label>
            <div className="mt-1 flex gap-1">
              <select
                value={consumidorTipoDocumento}
                onChange={(e) => setConsumidorTipoDocumento(e.target.value)}
                className="rounded-pill border border-musgo/30 px-2 py-2 text-sm"
              >
                <option value="DNI">DNI</option>
                <option value="CE">CE</option>
                <option value="PASAPORTE">Pasaporte</option>
              </select>
              <input
                required
                value={consumidorNumeroDocumento}
                onChange={(e) => setConsumidorNumeroDocumento(e.target.value)}
                className="w-full rounded-pill border border-musgo/30 px-3 py-2 text-sm"
              />
            </div>
          </div>
        </div>

        <div>
          <label className="text-xs font-medium uppercase text-bosque/60">Domicilio</label>
          <input
            required
            value={consumidorDomicilio}
            onChange={(e) => setConsumidorDomicilio(e.target.value)}
            className="mt-1 w-full rounded-pill border border-musgo/30 px-3 py-2 text-sm"
          />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs font-medium uppercase text-bosque/60">Teléfono</label>
            <input
              required
              value={consumidorTelefono}
              onChange={(e) => setConsumidorTelefono(e.target.value)}
              className="mt-1 w-full rounded-pill border border-musgo/30 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-xs font-medium uppercase text-bosque/60">Correo</label>
            <input
              required
              type="email"
              value={consumidorEmail}
              onChange={(e) => setConsumidorEmail(e.target.value)}
              className="mt-1 w-full rounded-pill border border-musgo/30 px-3 py-2 text-sm"
            />
          </div>
        </div>

        <div>
          <label className="text-xs font-medium uppercase text-bosque/60">Producto o servicio reclamado</label>
          <input
            required
            value={bienOServicioReclamado}
            onChange={(e) => setBienOServicioReclamado(e.target.value)}
            className="mt-1 w-full rounded-pill border border-musgo/30 px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label className="text-xs font-medium uppercase text-bosque/60">Monto reclamado (S/, opcional)</label>
          <input
            type="number"
            step="0.01"
            value={montoReclamado}
            onChange={(e) => setMontoReclamado(e.target.value)}
            className="mt-1 w-full rounded-pill border border-musgo/30 px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label className="text-xs font-medium uppercase text-bosque/60">Detalle</label>
          <textarea
            required
            rows={4}
            value={detalle}
            onChange={(e) => setDetalle(e.target.value)}
            className="mt-1 w-full rounded-card border border-musgo/30 px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label className="text-xs font-medium uppercase text-bosque/60">¿Qué solicitas?</label>
          <textarea
            required
            rows={3}
            value={pedidoConsumidor}
            onChange={(e) => setPedidoConsumidor(e.target.value)}
            className="mt-1 w-full rounded-card border border-musgo/30 px-3 py-2 text-sm"
          />
        </div>

        <ErrorBanner mensaje={error} />

        <button
          type="submit"
          disabled={enviando}
          className="w-full rounded-pill bg-bosque py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {enviando ? 'Enviando…' : 'Enviar reclamo'}
        </button>
      </form>
    </div>
  );
}
