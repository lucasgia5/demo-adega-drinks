import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useCart } from "@/context/CartContext";
import { useStoreConfig } from "@/context/StoreConfigContext";
import { brl } from "@/lib/api";
import { Minus, Plus, Trash2, ShoppingBag, Pencil } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import FreeShippingProgress from "@/components/FreeShippingProgress";
import ProductCustomizationDialog from "@/components/ProductCustomizationDialog";

export default function CartDrawer() {
  const { items, total, isOpen, setIsOpen, setQty, remove, updateCustomized } = useCart();
  const { config } = useStoreConfig();
  const navigate = useNavigate();
  const [editingItem, setEditingItem] = useState(null);

  const goCheckout = () => {
    setIsOpen(false);
    navigate("/checkout");
  };

  const continueShopping = () => {
    setIsOpen(false);
    navigate("/");
  };

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetContent side="right" className="w-full sm:max-w-md bg-brand-cream p-0 flex flex-col">
        <SheetHeader className="px-6 py-5 border-b border-stone-200 bg-white">
          <SheetTitle className="font-serif text-2xl text-stone-900">Seu Carrinho</SheetTitle>
          <p className="text-xs text-stone-500">{items.length} {items.length === 1 ? "item" : "itens"}</p>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3" data-testid="cart-items">
          {items.length === 0 && (
            <div className="h-full grid place-items-center text-center text-stone-500 py-12">
              <div>
                <ShoppingBag className="h-10 w-10 mx-auto mb-3 text-stone-300" />
                <p className="font-serif text-xl">Seu carrinho está vazio</p>
                <p className="text-sm mt-1">Adicione produtos para começar.</p>
              </div>
            </div>
          )}

          {items.map((item) => {
            const itemKey =
              item.cart_key ||
              `${item.item_type || "product"}:${item.combo_id || item.product_id}`;
            return (
            <div
              key={itemKey}
              data-testid={`cart-item-${itemKey}`}
              className="flex gap-3 bg-white rounded-xl p-3 border border-stone-100"
            >
              <div className="w-16 h-16 rounded-lg overflow-hidden bg-stone-100 shrink-0">
                {item.image_url ? (
                  <img src={item.image_url} alt={item.name} className="h-full w-full object-cover" />
                ) : null}
              </div>
              <div className="flex-1 min-w-0">
                {item.item_type === "combo" && (
                  <span className="mb-1 inline-flex rounded-full bg-brand/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-brand">
                    Combo
                  </span>
                )}
                <p className="font-medium text-sm text-stone-900 line-clamp-2">{item.name}</p>
                {item.item_type === "combo" && item.combo_items?.length > 0 && (
                  <p className="mt-1 line-clamp-2 text-xs text-stone-500">
                    {item.combo_items
                      .map((comboItem) => `${comboItem.quantity}x ${comboItem.name}`)
                      .join(" · ")}
                  </p>
                )}
                {item.selected_options?.length > 0 && (
                  <div className="mt-1 space-y-0.5 text-xs text-stone-500">
                    {item.selected_options.map((option) => (
                      <p key={`${option.group_id}:${option.option_id}`}>
                        <span className="font-medium text-stone-600">{option.group_name}:</span>{" "}
                        {option.quantity > 1 ? `${option.quantity}x ` : ""}{option.option_name}
                        {Number(option.additional_price || 0) > 0 && (
                          <span className="text-brand">
                            {" "}+{brl(Number(option.additional_price || 0) * Number(option.quantity || 1))}
                          </span>
                        )}
                      </p>
                    ))}
                  </div>
                )}
                {item.item_observation && (
                  <p className="mt-1 text-xs text-stone-500">
                    <span className="font-medium text-stone-600">Observação:</span> {item.item_observation}
                  </p>
                )}
                <p className="text-xs text-stone-500 mt-0.5">{brl(item.unit_price)} un.</p>
                <div className="mt-2 flex items-center gap-2">
                  <button
                    data-testid={`qty-decrease-${itemKey}`}
                    onClick={() => setQty(itemKey, item.quantity - 1)}
                    className="h-7 w-7 grid place-items-center rounded-md border border-stone-200 hover:bg-stone-50"
                    aria-label="Diminuir"
                  >
                    <Minus className="h-3 w-3" />
                  </button>
                  <span className="text-sm font-semibold w-6 text-center" data-testid={`qty-value-${itemKey}`}>
                    {item.quantity}
                  </span>
                  <button
                    data-testid={`qty-increase-${itemKey}`}
                    onClick={() => setQty(itemKey, item.quantity + 1)}
                    className="h-7 w-7 grid place-items-center rounded-md border border-stone-200 hover:bg-stone-50"
                    aria-label="Aumentar"
                  >
                    <Plus className="h-3 w-3" />
                  </button>
                  <button
                    data-testid={`remove-item-${itemKey}`}
                    onClick={() => remove(itemKey)}
                    className="ml-auto h-7 w-7 grid place-items-center rounded-md text-stone-400 hover:text-red-600"
                    aria-label="Remover"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                  {item.option_groups?.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setEditingItem({ ...item, itemKey })}
                      className="h-7 w-7 grid place-items-center rounded-md text-stone-400 hover:text-brand"
                      aria-label="Editar personalização"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
              <div className="text-sm font-semibold text-stone-900 shrink-0">
                {brl(item.unit_price * item.quantity)}
              </div>
            </div>
          )})}
        </div>

        <div className="border-t border-stone-200 bg-white p-5 space-y-3">
          {items.length > 0 && (
            <FreeShippingProgress subtotal={total} config={config} />
          )}
          <div className="flex items-center justify-between">
            <span className="text-stone-600">Total</span>
            <span className="font-serif text-2xl font-semibold text-brand" data-testid="cart-total">
              {brl(total)}
            </span>
          </div>
          <Button
            data-testid="checkout-btn"
            disabled={items.length === 0}
            onClick={goCheckout}
            className="w-full h-12 rounded-xl bg-brand hover:bg-brand-dark text-white font-medium"
          >
            Finalizar Pedido pelo WhatsApp
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={continueShopping}
            className="w-full h-11 rounded-xl"
            data-testid="continue-shopping"
          >
            Continuar comprando
          </Button>
        </div>
      </SheetContent>
      {editingItem && (
        <ProductCustomizationDialog
          product={{
            id: editingItem.product_id,
            name: editingItem.name,
            image_url: editingItem.image_url,
            price: editingItem.base_price,
            promo_active: false,
            option_groups: editingItem.option_groups || [],
          }}
          open={!!editingItem}
          onOpenChange={(open) => {
            if (!open) setEditingItem(null);
          }}
          initialQuantity={editingItem.quantity}
          initialSelectedOptions={editingItem.selected_options || []}
          initialObservation={editingItem.item_observation || ""}
          onConfirm={(customization) => {
            updateCustomized(
              editingItem.itemKey,
              {
                id: editingItem.product_id,
                name: editingItem.name,
                image_url: editingItem.image_url,
                price: editingItem.base_price,
                promo_active: false,
                option_groups: editingItem.option_groups || [],
              },
              customization
            );
            setEditingItem(null);
          }}
        />
      )}
    </Sheet>
  );
}
