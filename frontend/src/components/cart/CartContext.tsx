'use client';

// Carrito de compra en el cliente (localStorage). El checkout con Culqi/Yape
// y la persistencia en el backend (modelo Cart/CartItem, reserva de stock
// RN-016) quedan para cuando se conecte el flujo de pago — esto solo cubre
// agregar/quitar productos mientras se navega el catálogo.

import { createContext, useContext, useEffect, useState } from 'react';

export type ItemCarrito = {
  sku: string;
  nombre: string;
  precioUnitario: number;
  cantidad: number;
};

type CartContextValue = {
  items: ItemCarrito[];
  agregar: (item: Omit<ItemCarrito, 'cantidad'>) => void;
  actualizarCantidad: (sku: string, cantidad: number) => void;
  quitar: (sku: string) => void;
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
        setItems(JSON.parse(raw));
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

  return <CartContext.Provider value={{ items, agregar, actualizarCantidad, quitar }}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart debe usarse dentro de <CartProvider>');
  return ctx;
}
