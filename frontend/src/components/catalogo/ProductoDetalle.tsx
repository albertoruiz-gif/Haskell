'use client';

import { useEffect, useState } from 'react';
import { apiFetch, resolveAssetUrl } from '../../lib/api';

export type ProductoCompleto = {
  id: string;
  sku: string;
  nombre: string | null;
  categoria: string | null;
  linea: string | null;
  subcategoria: string | null;
  tipo: string | null;
  descripcion: string | null;
  beneficios: string | null;
  propiedades: string | null;
  activos: string | null;
  modoUso: string | null;
  pvp: number;
  precioAsesor: number;
  imagenUrl: string | null;
  imagenesAdicionales: string[];
  componentes: { id: string; sku: string; nombre: string | null; imagenUrl: string | null; descuentoPct: number }[];
  canal: string;
};

type Oferta = { alcance: string; descuentoPct: string | null; precioFijo: string | null; fin: string };

function Lista({ titulo, texto }: { titulo: string; texto: string | null }) {
  if (!texto) return null;
  const items = texto.split('|').map((t) => t.trim()).filter(Boolean);
  return (
    <div>
      <p className="text-xs font-medium uppercase text-bosque/60">{titulo}</p>
      <ul className="mt-1 space-y-1">
        {items.map((item) => (
          <li key={item} className="flex gap-2 text-sm text-bosque">
            <span className="text-musgo">●</span>
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ProductoDetalle({
  producto,
  onClose,
  onAgregar,
}: {
  producto: ProductoCompleto;
  onClose: () => void;
  onAgregar: () => void;
}) {
  const [oferta, setOferta] = useState<Oferta | null>(null);
  const imagenes = [producto.imagenUrl, ...producto.imagenesAdicionales].filter(Boolean) as string[];
  const [imagenActiva, setImagenActiva] = useState(0);

  useEffect(() => {
    apiFetch<Oferta | null>(`/campaigns/ofertas/vigente?catalogLineId=${producto.id}`)
      .then(setOferta)
      .catch(() => setOferta(null));
  }, [producto.id]);

  const precioConOferta = oferta
    ? oferta.precioFijo
      ? Number(oferta.precioFijo)
      : oferta.descuentoPct
        ? producto.precioAsesor * (1 - Number(oferta.descuentoPct) / 100)
        : null
    : null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center" onClick={onClose}>
      <div
        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-t-card bg-crema p-4 shadow-lg sm:rounded-card"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-end">
          <button aria-label="Cerrar" onClick={onClose} className="rounded-pill bg-white px-3 py-1 text-sm text-bosque shadow-sm">
            ✕
          </button>
        </div>

        {imagenes.length > 0 ? (
          <>
            <img
              src={resolveAssetUrl(imagenes[imagenActiva])}
              alt={producto.nombre ?? producto.sku}
              className="mt-2 h-64 w-full rounded-card object-cover"
            />
            {imagenes.length > 1 && (
              <div className="mt-2 flex gap-2 overflow-x-auto">
                {imagenes.map((img, i) => (
                  <button key={img} onClick={() => setImagenActiva(i)}>
                    <img
                      src={resolveAssetUrl(img)}
                      alt=""
                      className={`h-14 w-14 shrink-0 rounded-card object-cover ${i === imagenActiva ? 'ring-2 ring-acento' : 'opacity-70'}`}
                    />
                  </button>
                ))}
              </div>
            )}
          </>
        ) : (
          <div className="mt-2 flex h-64 items-center justify-center rounded-card border border-dashed border-musgo/30 text-xs text-bosque/50">
            foto producto
          </div>
        )}

        <div className="mt-3 space-y-3 rounded-card bg-white p-3 shadow-sm">
          <div>
            {producto.tipo && <span className="rounded-pill bg-musgo/20 px-2 py-1 text-xs font-medium text-musgo-dark">{producto.tipo}</span>}
            <h1 className="mt-1 text-lg font-medium text-bosque">{producto.nombre ?? producto.sku}</h1>
            <p className="text-xs text-bosque/50">{producto.sku} {producto.subcategoria && <>· {producto.subcategoria}</>}</p>
          </div>

          <div>
            {oferta && (
              <span className="mb-1 inline-block rounded-pill bg-promo px-2 py-1 text-xs font-medium text-white">
                Oferta {oferta.descuentoPct ? `-${Number(oferta.descuentoPct)}%` : 'precio especial'} · vence {new Date(oferta.fin).toLocaleDateString('es-PE')}
              </span>
            )}
            <p className="text-sm text-bosque/50 line-through">S/ {producto.pvp.toFixed(2)}</p>
            <p className="text-2xl font-medium text-acento">
              S/ {(precioConOferta ?? producto.precioAsesor).toFixed(2)}
            </p>
          </div>

          {producto.descripcion && (
            <div>
              <p className="text-xs font-medium uppercase text-bosque/60">Descripción</p>
              <p className="mt-1 text-sm text-bosque">{producto.descripcion}</p>
            </div>
          )}

          {producto.componentes.length > 0 && (
            <div>
              <p className="text-xs font-medium uppercase text-bosque/60">Este pack incluye</p>
              <div className="mt-1 space-y-1">
                {producto.componentes.map((c) => (
                  <div key={c.id} className="flex items-center gap-2 rounded-card bg-crema p-1.5">
                    {c.imagenUrl ? (
                      <img src={resolveAssetUrl(c.imagenUrl)} alt="" className="h-8 w-8 shrink-0 rounded-card object-cover" />
                    ) : (
                      <div className="h-8 w-8 shrink-0 rounded-card border border-dashed border-musgo/30" />
                    )}
                    <p className="text-xs text-bosque">{c.nombre ?? c.sku}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <Lista titulo="Beneficios" texto={producto.beneficios} />
          <Lista titulo="Propiedades" texto={producto.propiedades} />
          <Lista titulo="Activos" texto={producto.activos} />

          {producto.modoUso && (
            <div>
              <p className="text-xs font-medium uppercase text-bosque/60">Modo de uso</p>
              <p className="mt-1 text-sm text-bosque">{producto.modoUso}</p>
            </div>
          )}
        </div>

        <button
          onClick={() => {
            onAgregar();
            onClose();
          }}
          className="mt-3 w-full rounded-pill bg-bosque py-3 text-sm font-medium text-white"
        >
          Agregar al carrito
        </button>
      </div>
    </div>
  );
}
