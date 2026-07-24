import type { Metadata } from 'next';
import './globals.css';
import { NavTabs } from '../components/ui/NavTabs';
import { AuthGate } from '../components/auth/AuthGate';

export const metadata: Metadata = {
  title: 'Plataforma Comercial Multicanal',
  description: 'Catálogo, carrito, gestión y almacén — asesores multicanal',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>
        <div className="mx-auto max-w-md px-3 py-3">
          <NavTabs />
          <main className="mt-3">
            <AuthGate>{children}</AuthGate>
          </main>
        </div>
      </body>
    </html>
  );
}
