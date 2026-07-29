'use client';

// Revista digital editorial (flipbook tipo Yanbal) — distinta del
// "Catálogo/Precios" operativo (ese tiene precios por canal para que los
// asesores vendan). Esta es un sitio estático armado por fuera de la
// plataforma (portada, doble página en desktop, paso de hojas) que se sube
// como .zip y se publica con una URL propia para compartir con clientes.
// Nombrada distinto a propósito — comparte la palabra "catálogo" con la
// pestaña operativa y eso generaba confusión real (ver auditoría UX).

import { useEffect, useState } from 'react';
import { apiFetch, ApiError, resolveAssetUrl } from '../../lib/api';
import { ErrorBanner } from '../ui/ErrorBanner';

type CatalogoDigital = {
  id: string;
  nombre: string;
  raiz: string;
  activo: boolean;
  url: string;
  createdAt: string;
};

export function CatalogoDigitalTab() {
  const [catalogos, setCatalogos] = useState<CatalogoDigital[]>([]);
  const [nombre, setNombre] = useState('');
  const [archivo, setArchivo] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [copiado, setCopiado] = useState<string | null>(null);

  async function cargar() {
    try {
      const data = await apiFetch<CatalogoDigital[]>('/catalogos-digitales');
      setCatalogos(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo cargar los catálogos digitales.');
    }
  }

  useEffect(() => {
    cargar();
  }, []);

  async function subir(e: React.FormEvent) {
    e.preventDefault();
    if (!archivo) {
      setError('Elegí el archivo .zip del catálogo (index.html + imágenes).');
      return;
    }
    setError(null);
    setSubiendo(true);
    try {
      const form = new FormData();
      form.append('nombre', nombre);
      form.append('archivo', archivo);
      await apiFetch('/catalogos-digitales', { method: 'POST', body: form, isFormData: true });
      setNombre('');
      setArchivo(null);
      await cargar();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo subir el catálogo.');
    } finally {
      setSubiendo(false);
    }
  }

  async function cambiarActivo(id: string, activo: boolean) {
    setError(null);
    try {
      await apiFetch(`/catalogos-digitales/${id}/activo`, { method: 'PATCH', body: { activo } });
      await cargar();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo actualizar el catálogo.');
    }
  }

  async function eliminar(id: string) {
    setError(null);
    try {
      await apiFetch(`/catalogos-digitales/${id}`, { method: 'DELETE' });
      await cargar();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo eliminar el catálogo.');
    }
  }

  function copiarLink(catalogo: CatalogoDigital) {
    const url = resolveAssetUrl(catalogo.url) ?? '';
    navigator.clipboard.writeText(url).catch(() => {});
    setCopiado(catalogo.id);
    setTimeout(() => setCopiado((c) => (c === catalogo.id ? null : c)), 2000);
  }

  return (
    <div className="space-y-3">
      <div className="rounded-card bg-musgo/10 p-3 text-xs text-bosque/70">
        La revista digital (portada, paso de páginas, doble página en escritorio) se arma por fuera de la
        plataforma — no tiene relación con los precios de <strong>Catálogo/Precios</strong>. Acá solo se sube la
        carpeta exportada, comprimida en un <strong>.zip</strong> que contenga un{' '}
        <code className="rounded bg-white px-1">index.html</code> — la plataforma la publica y te da un link para
        compartir con tus clientes.
      </div>

      <ErrorBanner mensaje={error} />

      <form onSubmit={subir} className="space-y-2 rounded-card bg-white p-3 shadow-sm">
        <p className="text-sm font-medium text-bosque">Subir revista digital</p>
        <input
          required
          placeholder="Nombre (ej. Campaña Agosto 2026)"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          className="w-full rounded-pill border border-musgo/30 px-3 py-2 text-sm"
        />
        <input
          required
          type="file"
          accept=".zip"
          onChange={(e) => setArchivo(e.target.files?.[0] ?? null)}
          className="w-full text-sm"
        />
        <button
          type="submit"
          disabled={subiendo}
          className="w-full rounded-pill bg-bosque py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {subiendo ? 'Subiendo y publicando…' : 'Subir y publicar'}
        </button>
      </form>

      <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
        {catalogos.map((c) => (
          <div key={c.id} className="rounded-card bg-white p-3 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-bosque">{c.nombre}</p>
              <span
                className={`rounded-pill px-2 py-0.5 text-[11px] font-medium ${
                  c.activo ? 'bg-bosque text-white' : 'bg-crema text-bosque/50'
                }`}
              >
                {c.activo ? 'Activo' : 'Oculto'}
              </span>
            </div>
            <p className="mt-1 truncate text-[11px] text-bosque/40">{resolveAssetUrl(c.url)}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <a
                href={resolveAssetUrl(c.url)}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-pill bg-acento px-3 py-1 text-xs font-medium text-white"
              >
                Ver
              </a>
              <button onClick={() => copiarLink(c)} className="rounded-pill bg-bosque px-3 py-1 text-xs font-medium text-white">
                {copiado === c.id ? '✓ Copiado' : '🔗 Copiar link'}
              </button>
              <button
                onClick={() => cambiarActivo(c.id, !c.activo)}
                className="rounded-pill bg-crema px-3 py-1 text-xs font-medium text-bosque"
              >
                {c.activo ? 'Ocultar' : 'Reactivar'}
              </button>
              <button onClick={() => eliminar(c.id)} className="rounded-pill bg-red-50 px-3 py-1 text-xs font-medium text-red-600">
                Eliminar
              </button>
            </div>
          </div>
        ))}
        {catalogos.length === 0 && <p className="text-xs text-bosque/50">Todavía no subiste ninguna revista digital.</p>}
      </div>
    </div>
  );
}
