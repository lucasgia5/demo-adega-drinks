import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useCart } from "@/context/CartContext";
import { brl } from "@/lib/api";
import { Minus, Plus, Trash2, ShoppingBag } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";

export default function CartDrawer() {
  const { items, total, isOpen, setIsOpen, setQty, remove } = useCart();
  const navigate = useNavigate();

  const goCheckout = () => {
    setIsOpen(false);
    navigate("/checkout");
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

          {items.map((item) => (
            <div
              key={item.product_id}
              data-testid={`cart-item-${item.product_id}`}
              className="flex gap-3 bg-white rounded-xl p-3 border border-stone-100"
            >
              <div className="w-16 h-16 rounded-lg overflow-hidden bg-stone-100 shrink-0">
                {item.image_url ? (
                  <img src={item.image_url} alt={item.name} className="h-full w-full object-cover" />
                ) : null}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm text-stone-900 line-clamp-2">{item.name}</p>
                <p className="text-xs text-stone-500 mt-0.5">{brl(item.unit_price)} un.</p>
                <div className="mt-2 flex items-center gap-2">
                  <button
                    data-testid={`qty-decrease-${item.product_id}`}
                    onClick={() => setQty(item.product_id, item.quantity - 1)}
                    className="h-7 w-7 grid place-items-center rounded-md border border-stone-200 hover:bg-stone-50"
                    aria-label="Diminuir"
                  >
                    <Minus className="h-3 w-3" />
                  </button>
                  <span className="text-sm font-semibold w-6 text-center" data-testid={`qty-value-${item.product_id}`}>
                    {item.quantity}
                  </span>
                  <button
                    data-testid={`qty-increase-${item.product_id}`}
                    onClick={() => setQty(item.product_id, item.quantity + 1)}
                    className="h-7 w-7 grid place-items-center rounded-md border border-stone-200 hover:bg-stone-50"
                    aria-label="Aumentar"
                  >
                    <Plus className="h-3 w-3" />
                  </button>
                  <button
                    data-testid={`remove-item-${item.product_id}`}
                    onClick={() => remove(item.product_id)}
                    className="ml-auto h-7 w-7 grid place-items-center rounded-md text-stone-400 hover:text-red-600"
                    aria-label="Remover"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
              <div className="text-sm font-semibold text-stone-900 shrink-0">
                {brl(item.unit_price * item.quantity)}
              </div>
            </div>
          ))}
        </div>

        <div className="border-t border-stone-200 bg-white p-5 space-y-3">
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
        </div>
      </SheetContent>
    </Sheet>
  );
}
