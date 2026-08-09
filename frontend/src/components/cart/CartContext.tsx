'use client';

// Carrito de compra en el cliente (localStorage) — el checkout llama a
// POST /orders con el catalogLineId de cada item. La reserva de stock del
// modelo Cart/CartItem (RN-016) no está conectada: el pedido se crea
// directo al pagar, sin timer de reserva previo.

import { createContext, useContext, useEffect, useState } from 'react';

export type ItemCarrito = {
  catalogLineId: string;
  sku: string;
  nombre: string;
  precioUnitario: number;
  cantidad: number;
  stockDisponible?: number;
};

type CartContextValue = {
  items: ItemCarrito[];
  agregar: (item: Omit<ItemCarrito, 'cantidad'>) => void;
  actualizarCantidad: (sku: string, cantidad: number) => void;
  quitar: (sku: string) => void;
  vaciar: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);
const STORAGE_KEY = 'haskell.carrito';

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ItemCarrito[]>([]);
  const [listo, setListo] = useState(false);

  useEffect(() => {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      try {
        const guardado = JSON.parse(raw) as ItemCarrito[];
        // Carritos guardados antes de agregar catalogLineId no sirven para
        // el checkout — se descartan en vez de mandarlos rotos al backend.
        setItems(guardado.filter((i) => typeof i.catalogLineId === 'string'));
      } catch {
        // ignorar carrito corrupto
      }
    }
    setListo(true);
  }, []);

  useEffect(() => {
    if (listo) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [items, listo]);

  function agregar(item: Omit<ItemCarrito, 'cantidad'>) {
    setItems((prev) => {
      const existente = prev.find((i) => i.sku === item.sku);
      if (existente) {
        return prev.map((i) => (i.sku === item.sku ? { ...i, cantidad: i.cantidad + 1 } : i));
      }
      return [...prev, { ...item, cantidad: 1 }];
    });
  }

  function actualizarCantidad(sku: string, cantidad: number) {
    setItems((prev) => {
      if (cantidad <= 0) return prev.filter((i) => i.sku !== sku);
      return prev.map((i) => (i.sku === sku ? { ...i, cantidad } : i));
    });
  }

  function quitar(sku: string) {
    setItems((prev) => prev.filter((i) => i.sku !== sku));
  }

  function vaciar() {
    setItems([]);
  }

  return <CartContext.Provider value={{ items, agregar, actualizarCantidad, quitar, vaciar }}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart debe usarse dentro de <CartProvider>');
  return ctx;
}
