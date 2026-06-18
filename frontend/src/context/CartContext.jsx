import { createContext, useContext, useEffect, useMemo, useState } from "react";

const CartContext = createContext(null);
const STORAGE_KEY = "white_label_cart";

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

  const cartKey = (item) =>
    item.cart_key ||
    `${item.item_type || "product"}:${item.combo_id || item.product_id}`;

  const add = (product, qty = 1) => {
    setItems((curr) => {
      const key = `product:${product.id}`;
      const found = curr.find((i) => cartKey(i) === key);
      if (found) {
        return curr.map((i) =>
          cartKey(i) === key ? { ...i, quantity: i.quantity + qty } : i
        );
      }
      return [
        ...curr,
        {
          cart_key: key,
          item_type: "product",
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

  const addCombo = (combo, qty = 1) => {
    setItems((curr) => {
      const key = `combo:${combo.id}`;
      const found = curr.find((i) => cartKey(i) === key);
      if (found) {
        return curr.map((i) =>
          cartKey(i) === key ? { ...i, quantity: i.quantity + qty } : i
        );
      }
      return [
        ...curr,
        {
          cart_key: key,
          item_type: "combo",
          combo_id: combo.id,
          name: combo.name,
          image_url: combo.image_url,
          unit_price: Number(combo.promotional_price),
          combo_items: combo.resolved_products || [],
          quantity: qty,
        },
      ];
    });
    setIsOpen(true);
  };

  const remove = (itemKey) =>
    setItems((curr) => curr.filter((i) => cartKey(i) !== itemKey));

  const setQty = (itemKey, qty) =>
    setItems((curr) => {
      if (qty <= 0) return curr.filter((i) => cartKey(i) !== itemKey);
      return curr.map((i) => (cartKey(i) === itemKey ? { ...i, quantity: qty } : i));
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
      value={{ items, total, count, add, addCombo, remove, setQty, clear, isOpen, setIsOpen }}
    >
      {children}
    </CartContext.Provider>
  );
}

export const useCart = () => useContext(CartContext);
