import { PackagePlus } from "lucide-react";
import { brl } from "@/lib/api";
import { useCart } from "@/context/CartContext";

export default function ComboCard({ combo }) {
  const { addCombo } = useCart();

  return (
    <article
      className="grid min-w-[280px] snap-start grid-cols-[96px_1fr] overflow-hidden rounded-lg border border-stone-200 bg-white shadow-sm sm:min-w-0"
      data-testid={`combo-card-${combo.id}`}
    >
      <div className="bg-stone-100">
        {combo.image_url ? (
          <img
            src={combo.image_url}
            alt={combo.name}
            className="h-full min-h-40 w-full object-cover"
          />
        ) : (
          <div className="grid h-full min-h-40 place-items-center text-3xl font-semibold text-stone-300">
            {combo.name?.[0] || "C"}
          </div>
        )}
      </div>

      <div className="flex min-w-0 flex-col p-4">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-brand">
          Combo da semana
        </span>
        <h3 className="mt-1 font-serif text-xl font-semibold leading-tight text-stone-900">
          {combo.name}
        </h3>
        {combo.description && (
          <p className="mt-1 line-clamp-2 text-sm text-stone-500">{combo.description}</p>
        )}
        <ul className="mt-2 space-y-0.5 text-xs text-stone-600">
          {combo.resolved_products?.map((item) => (
            <li key={item.product_id}>
              {item.quantity}x {item.name}
            </li>
          ))}
        </ul>

        <div className="mt-auto flex items-end justify-between gap-3 pt-3">
          <span className="text-lg font-semibold text-brand">
            {brl(combo.promotional_price)}
          </span>
          <button
            type="button"
            onClick={() => addCombo(combo)}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-brand text-white transition-colors hover:bg-brand-dark"
            aria-label={`Adicionar combo ${combo.name} ao carrinho`}
            data-testid={`add-combo-${combo.id}`}
          >
            <PackagePlus className="h-4 w-4" />
          </button>
        </div>
      </div>
    </article>
  );
}
