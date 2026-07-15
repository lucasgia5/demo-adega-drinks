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

  const customizationSignature = (productId, selectedOptions = [], itemObservation = "") => {
    const optionPart = selectedOptions
      .map((option) => `${option.group_id}:${option.option_id}:${Number(option.quantity || 1)}`)
      .sort()
      .join("|");
    return `${productId}|${optionPart}|${(itemObservation || "").trim()}`;
  };

  const customizedCartKey = (productId, selectedOptions, itemObservation) =>
    `product:${productId}:custom:${customizationSignature(productId, selectedOptions, itemObservation)}`;

  const customizedItem = (product, customization) => {
    const selectedOptions = customization.selected_options || [];
    const itemObservation = (customization.item_observation || "").trim();
    const signature = customizationSignature(product.id, selectedOptions, itemObservation);
    return {
      cart_key: customizedCartKey(product.id, selectedOptions, itemObservation),
      customization_signature: signature,
      item_type: "product",
      product_id: product.id,
      name: product.name,
      image_url: product.image_url,
      quantity: customization.quantity,
      base_price: effectivePrice(product),
      unit_price: Number(customization.unit_price),
      selected_options: selectedOptions.map((option) => ({
        group_id: option.group_id,
        group_name: option.group_name,
        option_id: option.option_id,
        option_name: option.option_name,
        quantity: option.quantity,
        additional_price: option.additional_price,
      })),
      item_observation: itemObservation,
      option_groups: product.option_groups || [],
    };
  };

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

  const addCustomized = (product, customization) => {
    const nextItem = customizedItem(product, customization);

    setItems((curr) => {
      const found = curr.find((i) => cartKey(i) === nextItem.cart_key);
      if (found) {
        return curr.map((i) =>
          cartKey(i) === nextItem.cart_key ? { ...i, quantity: i.quantity + nextItem.quantity } : i
        );
      }
      return [...curr, nextItem];
    });
    setIsOpen(true);
  };

  const updateCustomized = (itemKey, product, customization) => {
    const nextItem = customizedItem(product, customization);
    setItems((curr) => {
      const withoutOriginal = curr.filter((item) => cartKey(item) !== itemKey);
      const found = withoutOriginal.find((item) => cartKey(item) === nextItem.cart_key);
      if (found) {
        return withoutOriginal.map((item) =>
          cartKey(item) === nextItem.cart_key
            ? { ...item, quantity: item.quantity + nextItem.quantity }
            : item
        );
      }
      return [...withoutOriginal, nextItem];
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
      value={{ items, total, count, add, addCustomized, updateCustomized, addCombo, remove, setQty, clear, isOpen, setIsOpen }}
    >
      {children}
    </CartContext.Provider>
  );
}

export const useCart = () => useContext(CartContext);
