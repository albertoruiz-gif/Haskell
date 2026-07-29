'use client';

import { useEffect, useState } from 'react';
import { apiFetch, ApiError } from '../../../lib/api';
import { ErrorBanner } from '../../ui/ErrorBanner';

type Tarifa = { id: string; distrito: string; zona: string | null; precio: string; slaHoras: number; activa: boolean };

const FORM_INICIAL = { distrito: '', zona: '', precio: '', slaHoras: '36' };

export function TarifarioSection() {
  const [tarifas, setTarifas] = useState<Tarifa[]>([]);
  const [form, setForm] = useState(FORM_INICIAL);
  const [edits, setEdits] = useState<Record<string, { precio?: string; slaHoras?: string }>>({});
  const [error, setError] = useState<string | null>(null);
  const [resultadoImport, setResultadoImport] = useState<{ total: number; creadas: number; actualizadas: number; errores: { fila: number; motivo: string }[] } | null>(null);
  const [importando, setImportando] = useState(false);

  async function cargar() {
    try {
      const data = await apiFetch<Tarifa[]>('/tarifas');
      setTarifas(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo cargar el tarifario.');
    }
  }

  useEffect(() => {
    cargar();
  }, []);

  async function crear(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await apiFetch('/tarifas', {
        method: 'POST',
        body: { distrito: form.distrito, zona: form.zona || undefined, precio: Number(form.precio), slaHoras: Number(form.slaHoras) },
      });
      setForm(FORM_INICIAL);
      await cargar();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo crear la tarifa.');
    }
  }

  async function guardar(t: Tarifa) {
    const edit = edits[t.id];
    if (!edit) return;
    setError(null);
    try {
      await apiFetch(`/tarifas/${t.id}`, {
        method: 'PATCH',
        body: {
          precio: edit.precio !== undefined ? Number(edit.precio) : undefined,
          slaHoras: edit.slaHoras !== undefined ? Number(edit.slaHoras) : undefined,
        },
      });
      await cargar();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo actualizar la tarifa.');
    }
  }

  async function importarArchivo(archivo: File) {
    setError(null);
    setResultadoImport(null);
    setImportando(true);
    try {
      const formData = new FormData();
      formData.append('archivo', archivo);
      const resultado = await apiFetch<{ total: number; creadas: number; actualizadas: number; errores: { fila: number; motivo: string }[] }>(
        '/tarifas/importar',
        { method: 'POST', body: formData, isFormData: true },
      );
      setResultadoImport(resultado);
      await cargar();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo importar el archivo.');
    } finally {
      setImportando(false);
    }
  }

  async function toggleActiva(t: Tarifa) {
    setError(null);
    try {
      await apiFetch(`/tarifas/${t.id}`, { method: 'PATCH', body: { activa: !t.activa } });
      await cargar();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo actualizar la tarifa.');
    }
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
      <div className="space-y-2 rounded-card bg-white p-3 shadow-sm">
        <p className="text-sm font-medium text-bosque">Cargar tarifario (Excel o CSV)</p>
        <p className="text-xs text-bosque/50">Columnas esperadas: distrito, zona (opcional), precio, slaHoras (opcional, 36 por defecto). Un distrito repetido actualiza la fila existente.</p>
        <label className="block w-full cursor-pointer rounded-pill bg-crema py-2 text-center text-sm font-medium text-bosque">
          {importando ? 'Importando…' : 'Elegir archivo .xlsx o .csv'}
          <input
            type="file"
            accept=".xlsx,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="hidden"
            disabled={importando}
            onChange={(e) => e.target.files?.[0] && importarArchivo(e.target.files[0])}
          />
        </label>
        {resultadoImport && (
          <div className="rounded-card bg-musgo/10 p-2 text-xs text-bosque">
            <p>{resultadoImport.creadas} creadas, {resultadoImport.actualizadas} actualizadas de {resultadoImport.total} filas.</p>
            {resultadoImport.errores.length > 0 && (
              <ul className="mt-1 list-disc pl-4 text-red-600">
                {resultadoImport.errores.map((er) => <li key={er.fila}>Fila {er.fila}: {er.motivo}</li>)}
              </ul>
            )}
          </div>
        )}
      </div>

      <form onSubmit={crear} className="space-y-2 rounded-card bg-white p-3 shadow-sm">
        <p className="text-sm font-medium text-bosque">Nuevo distrito</p>
        <input required placeholder="Distrito" value={form.distrito} onChange={(e) => setForm((f) => ({ ...f, distrito: e.target.value }))} className="w-full rounded-pill border border-musgo/30 px-3 py-2 text-sm" />
        <input placeholder="Zona (opcional)" value={form.zona} onChange={(e) => setForm((f) => ({ ...f, zona: e.target.value }))} className="w-full rounded-pill border border-musgo/30 px-3 py-2 text-sm" />
        <div className="grid grid-cols-2 gap-2">
          <input required type="number" step="0.01" placeholder="Precio envío (S/)" value={form.precio} onChange={(e) => setForm((f) => ({ ...f, precio: e.target.value }))} className="rounded-pill border border-musgo/30 px-3 py-2 text-sm" />
          <input required type="number" placeholder="Plazo (horas)" value={form.slaHoras} onChange={(e) => setForm((f) => ({ ...f, slaHoras: e.target.value }))} className="rounded-pill border border-musgo/30 px-3 py-2 text-sm" />
        </div>
        <ErrorBanner mensaje={error} />
        <button type="submit" className="w-full rounded-pill bg-bosque py-2 text-sm font-medium text-white">Agregar distrito</button>
      </form>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {tarifas.map((t) => (
          <div key={t.id} className="rounded-card bg-white p-3 shadow-sm">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium">{t.distrito} {t.zona && <span className="text-bosque/50">· {t.zona}</span>}</p>
              </div>
              <button onClick={() => toggleActiva(t)} className={`rounded-pill px-3 py-1 text-xs font-medium ${t.activa ? 'bg-bosque text-white' : 'bg-red-100 text-red-700'}`}>
                {t.activa ? 'Activa' : 'Inactiva'}
              </button>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <div>
                <label className="text-[11px] text-bosque/50">Precio envío (S/)</label>
                <input type="number" step="0.01" defaultValue={t.precio} onChange={(e) => setEdits((s) => ({ ...s, [t.id]: { ...s[t.id], precio: e.target.value } }))} className="w-full rounded-pill border border-musgo/30 px-3 py-1.5 text-sm" />
              </div>
              <div>
                <label className="text-[11px] text-bosque/50">Plazo (horas)</label>
                <input type="number" defaultValue={t.slaHoras} onChange={(e) => setEdits((s) => ({ ...s, [t.id]: { ...s[t.id], slaHoras: e.target.value } }))} className="w-full rounded-pill border border-musgo/30 px-3 py-1.5 text-sm" />
              </div>
            </div>
            <button onClick={() => guardar(t)} className="mt-2 w-full rounded-pill bg-acento py-2 text-xs font-medium text-white">Guardar cambios</button>
          </div>
        ))}
        {tarifas.length === 0 && <p className="text-xs text-bosque/50">Todavía no hay distritos cargados.</p>}
      </div>
    </div>
  );
}
