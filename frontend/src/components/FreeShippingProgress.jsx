import { CheckCircle2, Truck } from "lucide-react";
import { brl } from "@/lib/api";

export default function FreeShippingProgress({ subtotal, config, fulfillmentType = "delivery" }) {
  const enabled = config?.free_shipping_enabled === true;
  const minimum = Number(config?.free_shipping_minimum);

  if (!enabled || fulfillmentType !== "delivery" || !Number.isFinite(minimum) || minimum < 0) {
    return null;
  }

  const remaining = Math.max(0, minimum - Number(subtotal || 0));
  const reached = remaining === 0;
  const progress = minimum === 0 ? 100 : Math.min(100, (Number(subtotal || 0) / minimum) * 100);

  return (
    <div
      className={`rounded-xl border p-3 ${
        reached
          ? "border-emerald-200 bg-emerald-50 text-emerald-800"
          : "border-brand/15 bg-brand/5 text-stone-700"
      }`}
      data-testid="free-shipping-progress"
    >
      <div className="flex items-center gap-2 text-sm font-medium">
        {reached ? (
          <CheckCircle2 className="h-4 w-4 shrink-0" />
        ) : (
          <Truck className="h-4 w-4 shrink-0 text-brand" />
        )}
        <span>
          {reached
            ? "Você ganhou frete grátis 🎉"
            : `Faltam ${brl(remaining)} para frete grátis`}
        </span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/80">
        <div
          className={`h-full rounded-full transition-[width] duration-300 ${
            reached ? "bg-emerald-500" : "bg-brand"
          }`}
          style={{ width: `${progress}%` }}
          aria-hidden="true"
        />
      </div>
    </div>
  );
}
