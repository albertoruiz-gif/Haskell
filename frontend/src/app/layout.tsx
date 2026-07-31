import type { Metadata } from 'next';
import './globals.css';
import { NavTabs } from '../components/ui/NavTabs';
import { AuthGate } from '../components/auth/AuthGate';
import { CartProvider } from '../components/cart/CartContext';

export const metadata: Metadata = {
  title: 'Plataforma Comercial Multicanal',
  description: 'Catálogo, carrito, gestión y almacén — asesores multicanal',
};

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
          </CartProvider>
        </div>
      </body>
    </html>
  );
}
