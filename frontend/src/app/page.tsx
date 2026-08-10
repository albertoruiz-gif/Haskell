'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { apiFetch, resolveAssetUrl } from '../lib/api';
import { isAuthenticated } from '../lib/auth';

type ProductoPublico = {
  sku: string;
  nombre: string | null;
  descripcion: string | null;
  pvp: number;
  imagenUrl: string | null;
};

// Home pública — requisito de Culqi (docs/PROMPT_culqi_requisitos_web.md):
// antes esta ruta redirigía directo a /catalogo (autenticado), así que
// cualquier visitante sin cuenta terminaba en la pantalla de login sin ver
// nada. Un usuario ya logueado sigue yendo directo a su catálogo — esta
// vitrina es solo para quien todavía no tiene sesión.
export default function HomePage() {
  const router = useRouter();
  const [productos, setProductos] = useState<ProductoPublico[]>([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    if (isAuthenticated()) {
      router.replace('/catalogo');
    }
  }, [router]);

  useEffect(() => {
    apiFetch<{ productos: ProductoPublico[] }>('/catalogo/publico')
      .then((data) => setProductos(data.productos))
      .catch(() => setProductos([]))
      .finally(() => setCargando(false));
  }, []);

  return (
    <div className="space-y-8">
      <section className="rounded-card bg-bosque p-6 text-white sm:p-10">
        <h1 className="text-2xl font-medium sm:text-3xl">Haskell Cosméticos</h1>
        <p className="mt-3 max-w-2xl text-sm text-white/85 sm:text-base">
          Comercializamos productos de belleza y cuidado capilar en Perú — champús, acondicionadores, mascarillas de
          tratamiento y más, de las líneas Haskell — a través de nuestra red propia de asesoras y asesores
          comerciales.
        </p>
        <Link
          href="/login"
          className="mt-5 inline-block rounded-pill bg-white px-5 py-2 text-sm font-medium text-bosque"
        >
          Ingresar a mi cuenta
        </Link>
      </section>

      <section>
        <h2 className="text-lg font-medium text-bosque">Algunos de nuestros productos</h2>
        <p className="mt-1 text-xs text-bosque/60">
          Precios referenciales en Soles (S/), incluyen impuestos de ley. El detalle de envío y disponibilidad se
          confirma al momento del pedido, a través de tu asesora o asesor.
        </p>

        {cargando ? (
          <p className="mt-4 text-sm text-bosque/60">Cargando productos…</p>
        ) : productos.length === 0 ? (
          <p className="mt-4 text-sm text-bosque/60">No hay productos publicados por el momento.</p>
        ) : (
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {productos.map((p) => (
              <div key={p.sku} className="rounded-card bg-white p-3 shadow-sm">
                <div className="relative aspect-square w-full overflow-hidden rounded-card bg-crema">
                  {p.imagenUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={resolveAssetUrl(p.imagenUrl)} alt={p.nombre ?? p.sku} className="h-full w-full object-cover" />
                  )}
                </div>
                <p className="mt-2 text-sm font-medium text-bosque">{p.nombre ?? p.sku}</p>
                {p.descripcion && <p className="mt-1 line-clamp-2 text-xs text-bosque/60">{p.descripcion}</p>}
                <p className="mt-2 text-sm font-medium text-acento">S/ {p.pvp.toFixed(2)}</p>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
