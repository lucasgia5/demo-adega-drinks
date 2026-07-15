import { Trash2 } from "lucide-react";
import { brl } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import OrderControls from "@/components/admin/OrderControls";

export default function ProductOptionEditor({
  option,
  index,
  total,
  onChange,
  onMove,
  onRemove,
}) {
  const additionalPrice = Number(option.additional_price || 0);

  return (
    <div className={`rounded-lg border p-3 ${
      option.active === false
        ? "border-stone-200 bg-stone-100 opacity-75"
        : "border-stone-200 bg-white"
    }`}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
        <OrderControls
          index={index}
          total={total}
          label={option.name || "opção"}
          onMoveUp={() => onMove(index, index - 1)}
          onMoveDown={() => onMove(index, index + 1)}
        />

        <div className="grid min-w-0 flex-1 gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label>Nome da opção</Label>
            <Input
              value={option.name || ""}
              onChange={(event) => onChange({ ...option, name: event.target.value })}
              placeholder="Ex.: Extra"
            />
          </div>
          <div>
            <Label>Preço adicional</Label>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={option.additional_price ?? ""}
              onChange={(event) => onChange({ ...option, additional_price: event.target.value })}
            />
            <p className="mt-1 text-xs text-stone-500">{brl(additionalPrice)}</p>
          </div>
          <div>
            <Label>Quantidade máxima</Label>
            <Input
              type="number"
              min="1"
              step="1"
              value={option.max_quantity ?? 1}
              onChange={(event) => onChange({ ...option, max_quantity: event.target.value })}
            />
          </div>
          <div className="flex items-center justify-between rounded-lg border border-stone-200 p-2">
            <span className="text-xs text-stone-600">Recomendado</span>
            <Switch
              checked={option.recommended === true}
              onCheckedChange={(recommended) => onChange({ ...option, recommended })}
            />
          </div>
          <div className="flex items-center justify-between rounded-lg border border-stone-200 p-2">
            <span className="text-xs text-stone-600">Mais pedido</span>
            <Switch
              checked={option.popular === true}
              onCheckedChange={(popular) => onChange({ ...option, popular })}
            />
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 sm:flex-col sm:items-end">
          <div className="flex items-center gap-2">
            <span className="text-xs text-stone-500">Ativa</span>
            <Switch
              checked={option.active !== false}
              onCheckedChange={(active) => onChange({ ...option, active })}
            />
          </div>
          {option.active === false && (
            <span className="rounded-full bg-stone-200 px-2 py-0.5 text-[10px] font-medium text-stone-700">
              Indisponível
            </span>
          )}
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={onRemove}
            className="h-8 w-8 text-red-600 hover:bg-red-50 hover:text-red-700"
            aria-label={`Excluir opção ${option.name || ""}`}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
