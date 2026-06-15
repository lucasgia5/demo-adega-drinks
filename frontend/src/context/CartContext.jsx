import { createContext, useContext, useEffect, useMemo, useState } from "react";

const CartContext = createContext(null);
const STORAGE_KEY = "adega_cart";

export function CartProvider({ children }) {
  const [items, setItems] = useState(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  });
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [items]);

  const effectivePrice = (p) =>
    p.promo_active && p.promo_price != null ? Number(p.promo_price) : Number(p.price);

  const add = (product, qty = 1) => {
    setItems((curr) => {
      const found = curr.find((i) => i.product_id === product.id);
      if (found) {
        return curr.map((i) =>
          i.product_id === product.id ? { ...i, quantity: i.quantity + qty } : i
        );
      }
      return [
        ...curr,
        {
          product_id: product.id,
          name: product.name,
          image_url: product.image_url,
          unit_price: effectivePrice(product),
          quantity: qty,
        },
      ];
    });
    setIsOpen(true);
  };

  const remove = (productId) =>
    setItems((curr) => curr.filter((i) => i.product_id !== productId));

  const setQty = (productId, qty) =>
    setItems((curr) => {
      if (qty <= 0) return curr.filter((i) => i.product_id !== productId);
      return curr.map((i) => (i.product_id === productId ? { ...i, quantity: qty } : i));
    });

  const clear = () => setItems([]);

  const total = useMemo(
    () => items.reduce((sum, i) => sum + i.unit_price * i.quantity, 0),
    [items]
  );
  const count = useMemo(
    () => items.reduce((sum, i) => sum + i.quantity, 0),
    [items]
  );

  return (
    <CartContext.Provider
      value={{ items, total, count, add, remove, setQty, clear, isOpen, setIsOpen }}
    >
      {children}
    </CartContext.Provider>
  );
}

export const useCart = () => useContext(CartContext);
