'use client';

// EP-03 — carga masiva de productos vía UI (antes solo con scripts Python
// offline, ver catalogo-haskell/). Mismo patrón de preview-sin-persistir +
// confirmar que ya usa afiliación para carga masiva de asesores.

import { useState } from 'react';
import { apiFetch, ApiError } from '../../lib/api';
import { ErrorBanner } from '../ui/ErrorBanner';

type Valida = { sku: string; nombre: string; pvpCampania: string; [k: string]: string };
type ErrorFila = { fila: number; campo: string; motivo: string };

export function CargaMasivaCatalogoModal({
  catalogId,
  onClose,
  onCargado,
}: {
  catalogId: string;
  onClose: () => void;
  onCargado: () => void;
}) {
  const [archivo, setArchivo] = useState<File | null>(null);
  const [validos, setValidos] = useState<Valida[] | null>(null);
  const [errores, setErrores] = useState<ErrorFila[]>([]);
  const [cargando, setCargando] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function previsualizar() {
    if (!archivo) {
      setError('Elegí un archivo Excel (.xlsx) primero.');
      return;
    }
    setError(null);
    setCargando(true);
    try {
      const fd = new FormData();
      fd.append('catalogId', catalogId);
      fd.append('archivo', archivo);
      const r = await apiFetch<{ validos: Valida[]; errores: ErrorFila[] }>('/catalogo/admin/lineas/masiva/previsualizar', {
        method: 'POST',
        body: fd,
        isFormData: true,
      });
      setValidos(r.validos);
      setErrores(r.errores);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo leer el archivo.');
    } finally {
      setCargando(false);
    }
  }

  async function confirmar() {
    if (!validos || validos.length === 0) return;
    setError(null);
    setConfirmando(true);
    try {
      await apiFetch<{ creadas: number }>('/catalogo/admin/lineas/masiva/confirmar', {
        method: 'POST',
        body: { catalogId, filas: validos },
      });
      onCargado();
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo confirmar la carga.');
    } finally {
      setConfirmando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center" onClick={onClose}>
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-card bg-crema p-4 shadow-lg sm:rounded-card"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-bosque">Carga masiva de productos</p>
          <button aria-label="Cerrar" onClick={onClose} className="rounded-pill bg-white px-3 py-1 text-sm text-bosque shadow-sm">✕</button>
        </div>

        <div className="mt-3 space-y-3 rounded-card bg-white p-3 shadow-sm">
          <p className="text-xs text-bosque/60">
            Excel con encabezados en la primera fila: <code className="rounded bg-crema px-1">sku</code>,{' '}
            <code className="rounded bg-crema px-1">nombre</code>, <code className="rounded bg-crema px-1">pvp</code> (obligatorios),
            y opcionalmente <code className="rounded bg-crema px-1">categoria</code>, <code className="rounded bg-crema px-1">linea</code>,{' '}
            <code className="rounded bg-crema px-1">subcategoria</code>, <code className="rounded bg-crema px-1">tipo</code>,{' '}
            <code className="rounded bg-crema px-1">descripcion</code>, <code className="rounded bg-crema px-1">beneficios</code>,{' '}
            <code className="rounded bg-crema px-1">propiedades</code>, <code className="rounded bg-crema px-1">modo_uso</code>,{' '}
            <code className="rounded bg-crema px-1">activos</code>.
          </p>

          <input
            type="file"
            accept=".xlsx"
            onChange={(e) => { setArchivo(e.target.files?.[0] ?? null); setValidos(null); setErrores([]); }}
            className="block w-full text-xs text-bosque/70"
          />

          <ErrorBanner mensaje={error} />

          {validos === null ? (
            <button
              onClick={previsualizar}
              disabled={!archivo || cargando}
              className="w-full rounded-pill bg-bosque py-2 text-sm font-medium text-white disabled:opacity-60"
            >
              {cargando ? 'Leyendo…' : 'Previsualizar'}
            </button>
          ) : (
            <>
              <p className="text-xs text-bosque/70">
                <span className="font-medium text-musgo-dark">{validos.length} listos para cargar.</span>
                {errores.length > 0 && <span className="text-red-600"> {errores.length} con error (no se cargan).</span>}
              </p>
              {errores.length > 0 && (
                <ul className="max-h-32 space-y-0.5 overflow-y-auto rounded-card bg-red-50 p-2 text-xs text-red-700">
                  {errores.map((e, i) => (
                    <li key={i}>Fila {e.fila} — {e.campo}: {e.motivo}</li>
                  ))}
                </ul>
              )}
              <div className="flex gap-2">
                <button
                  onClick={confirmar}
                  disabled={validos.length === 0 || confirmando}
                  className="flex-1 rounded-pill bg-bosque py-2 text-sm font-medium text-white disabled:opacity-60"
                >
                  {confirmando ? 'Cargando…' : `Confirmar carga de ${validos.length}`}
                </button>
                <button onClick={() => { setValidos(null); setErrores([]); }} className="rounded-pill bg-white px-3 py-2 text-sm text-bosque shadow-sm">
                  Volver a elegir archivo
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
