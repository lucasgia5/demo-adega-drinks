import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api, { brl } from "@/lib/api";
import Header from "@/components/Header";
import CartDrawer from "@/components/CartDrawer";
import { useCart } from "@/context/CartContext";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Plus, Minus } from "lucide-react";

export default function ProductDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [product, setProduct] = useState(null);
  const [qty, setQty] = useState(1);
  const { add } = useCart();

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get(`/products/${id}`);
        setProduct(data);
      } catch {
        setProduct(false);
      }
    })();
  }, [id]);

  if (product === null) {
    return (
      <div className="min-h-screen bg-brand-cream">
        <Header />
        <div className="max-w-3xl mx-auto px-4 py-20 text-stone-500">Carregando...</div>
      </div>
    );
  }
  if (product === false) {
    return (
      <div className="min-h-screen bg-brand-cream">
        <Header />
        <div className="max-w-3xl mx-auto px-4 py-20 text-center">
          <p className="text-stone-700">Produto não encontrado.</p>
          <Button className="mt-4 bg-brand hover:bg-brand-dark" onClick={() => navigate("/")}>
            Voltar à loja
          </Button>
        </div>
      </div>
    );
  }

  const isPromo = product.promo_active && product.promo_price != null;
  const price = isPromo ? product.promo_price : product.price;

  return (
    <div className="min-h-screen bg-brand-cream">
      <Header />
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <button
          onClick={() => navigate(-1)}
          className="inline-flex items-center text-sm text-stone-600 hover:text-brand mb-4"
          data-testid="back-btn"
        >
          <ArrowLeft className="h-4 w-4 mr-1.5" /> Voltar
        </button>

        <div className="grid lg:grid-cols-2 gap-8 lg:gap-12">
          <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden">
            <div className="aspect-square bg-stone-50">
              {product.image_url ? (
                <img src={product.image_url} alt={product.name} className="h-full w-full object-cover" />
              ) : null}
            </div>
          </div>

          <div>
            {isPromo && (
              <span className="bg-brand text-white text-xs uppercase tracking-wider font-semibold px-2 py-1 rounded-full">
                Promoção
              </span>
            )}
            <h1 className="font-serif text-4xl sm:text-5xl font-semibold text-stone-900 mt-3" data-testid="product-name">
              {product.name}
            </h1>
            <p className="mt-4 text-stone-600 leading-relaxed">{product.description}</p>

            <div className="mt-6 flex items-end gap-3">
              {isPromo && (
                <span className="text-stone-400 line-through decoration-red-500/60 text-lg">
                  {brl(product.price)}
                </span>
              )}
              <span className="font-serif text-4xl font-semibold text-brand" data-testid="product-detail-price">
                {brl(price)}
              </span>
            </div>

            <div className="mt-8 flex items-center gap-4">
              <div className="inline-flex items-center rounded-xl border border-stone-200 bg-white">
                <button
                  onClick={() => setQty((q) => Math.max(1, q - 1))}
                  className="h-11 w-11 grid place-items-center hover:bg-stone-50"
                  aria-label="Diminuir"
                  data-testid="detail-qty-decrease"
                >
                  <Minus className="h-4 w-4" />
                </button>
                <span className="w-10 text-center font-medium" data-testid="detail-qty-value">{qty}</span>
                <button
                  onClick={() => setQty((q) => q + 1)}
                  className="h-11 w-11 grid place-items-center hover:bg-stone-50"
                  aria-label="Aumentar"
                  data-testid="detail-qty-increase"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
              <Button
                disabled={!product.available}
                onClick={() => add(product, qty)}
                className="flex-1 h-12 rounded-xl bg-brand hover:bg-brand-dark text-white font-medium"
                data-testid="detail-add-to-cart"
              >
                {product.available ? "Adicionar ao carrinho" : "Indisponível"}
              </Button>
            </div>
          </div>
        </div>
      </div>
      <CartDrawer />
    </div>
  );
}
