import { Link } from "react-router-dom";
import { Plus } from "lucide-react";
import { brl } from "@/lib/api";
import { useCart } from "@/context/CartContext";

export default function ProductCard({ product }) {
  const { add } = useCart();
  const isPromo = product.promo_active && product.promo_price != null;
  const unavailable = !product.available;

  return (
    <div
      data-testid={`product-card-${product.id}`}
      className={`group relative bg-white rounded-2xl border border-stone-200 overflow-hidden transition-all duration-300 ${
        unavailable ? "opacity-50" : "hover:-translate-y-1 hover:shadow-[0_12px_32px_-8px_rgba(114,47,55,0.18)]"
      }`}
    >
      {isPromo && (
        <span
          className="absolute top-3 left-3 z-10 bg-brand text-white text-[10px] uppercase tracking-wider font-semibold px-2 py-1 rounded-full"
          data-testid="promo-badge"
        >
          Promo
        </span>
      )}
      {unavailable && (
        <span className="absolute top-3 right-3 z-10 bg-stone-900/80 text-white text-[10px] uppercase tracking-wider px-2 py-1 rounded-full">
          Indisponível
        </span>
      )}
      <Link to={`/produto/${product.id}`} className="block bg-stone-50">
        <div className="aspect-[4/5] overflow-hidden">
          {product.image_url ? (
            <img
              src={product.image_url}
              alt={product.name}
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
          ) : (
            <div className="h-full w-full grid place-items-center text-stone-300 font-serif text-3xl">
              {product.name?.[0] || "?"}
            </div>
          )}
        </div>
      </Link>

      <div className="p-4">
        <Link to={`/produto/${product.id}`}>
          <h3 className="font-serif text-lg leading-snug text-stone-900 line-clamp-2 group-hover:text-brand transition-colors">
            {product.name}
          </h3>
        </Link>

        <div className="mt-3 flex items-end justify-between gap-2">
          <div className="flex flex-col">
            {isPromo && (
              <span className="text-xs text-stone-400 line-through decoration-red-500/60">
                {brl(product.price)}
              </span>
            )}
            <span
              className={`font-semibold ${isPromo ? "text-brand text-lg" : "text-stone-900 text-base"}`}
              data-testid="product-price"
            >
              {brl(isPromo ? product.promo_price : product.price)}
            </span>
          </div>

          <button
            disabled={unavailable}
            onClick={() => add(product)}
            data-testid={`add-to-cart-btn-${product.id}`}
            aria-label="Adicionar ao carrinho"
            className="h-10 w-10 rounded-xl bg-brand text-white grid place-items-center hover:bg-brand-dark transition-colors disabled:bg-stone-300 disabled:cursor-not-allowed"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
