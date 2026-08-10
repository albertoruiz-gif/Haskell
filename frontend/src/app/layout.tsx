import type { Metadata } from 'next';
import Script from 'next/script';
import './globals.css';
import { NavTabs } from '../components/ui/NavTabs';
import { Footer } from '../components/ui/Footer';
import { AuthGate } from '../components/auth/AuthGate';
import { CartProvider } from '../components/cart/CartContext';

export const metadata: Metadata = {
  title: 'Plataforma Comercial Multicanal',
  description: 'Catálogo, carrito, gestión y almacén — asesores multicanal',
};

// Hasky (Live Chat de Odoo) — se activa solo cuando NEXT_PUBLIC_ODOO_LIVECHAT_ACTIVO=true
// en el .env del ambiente. En Desarrollo y Testeo queda en false a propósito:
// el widget conecta contra el Odoo real (Haskell_Distribuidor), así que probarlo
// ahí crearía leads/oportunidades reales en el CRM. Solo Producción lo activa.
const livechatActivo = process.env.NEXT_PUBLIC_ODOO_LIVECHAT_ACTIVO === 'true';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>
        <div className="mx-auto max-w-md px-3 py-3 sm:max-w-2xl lg:max-w-6xl lg:px-8 lg:py-6 xl:max-w-7xl 2xl:max-w-[1600px]">
          <CartProvider>
            <NavTabs />
            <main className="mt-3 lg:mt-6">
              <AuthGate>{children}</AuthGate>
            </main>
            <Footer />
          </CartProvider>
        </div>
        {livechatActivo && (
          <>
            <Script
              src="https://efficaxba-online.odoo.com/im_livechat/loader/2"
              strategy="lazyOnload"
            />
            <Script
              src="https://efficaxba-online.odoo.com/im_livechat/assets_embed.js"
              strategy="lazyOnload"
            />
          </>
        )}
      </body>
    </html>
  );
}
