import { Copy, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import OrderControls from "@/components/admin/OrderControls";
import ProductOptionEditor from "@/components/admin/ProductOptionEditor";

const SELECTION_TYPES = [
  { value: "single", label: "Seleção única" },
  { value: "multiple", label: "Seleção múltipla" },
  { value: "quantity", label: "Controle de quantidade" },
];

const newOption = (order) => ({
  name: "",
  description: "",
  additional_price: "",
  max_quantity: 1,
  order,
  active: true,
  recommended: false,
  popular: false,
});

function reorder(list, from, to) {
  if (to < 0 || to >= list.length) return list;
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next.map((entry, order) => ({ ...entry, order }));
}

export default function OptionGroupCard({
  group,
  index,
  total,
  onChange,
  onMove,
  onRemove,
  onDuplicate,
}) {
  const options = group.options || [];
  const minSelections = Number(group.min_selections || 0);
  const maxSelections = Number(group.max_selections || 0);
  const hasInvalidRange = maxSelections < minSelections;

  const updateOption = (optionIndex, option) => {
    onChange({
      ...group,
      options: options.map((current, currentIndex) =>
        currentIndex === optionIndex ? option : current
      ),
    });
  };

  const moveOption = (from, to) => {
    onChange({ ...group, options: reorder(options, from, to) });
  };

  const removeOption = (optionIndex) => {
    onChange({
      ...group,
      options: options.filter((_, currentIndex) => currentIndex !== optionIndex)
        .map((option, order) => ({ ...option, order })),
    });
  };

  const addOption = () => {
    onChange({
      ...group,
      options: [...options, newOption(options.length)],
    });
  };

  return (
    <div className={`rounded-lg border p-3 sm:p-4 ${
      group.active === false
        ? "border-stone-200 bg-stone-100 opacity-75"
        : "border-stone-200 bg-stone-50"
    }`}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
        <OrderControls
          index={index}
          total={total}
          label={group.name || "grupo"}
          onMoveUp={() => onMove(index, index - 1)}
          onMoveDown={() => onMove(index, index + 1)}
        />

        <div className="min-w-0 flex-1 space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>Nome do grupo</Label>
              <Input
                value={group.name || ""}
                onChange={(event) => onChange({ ...group, name: event.target.value })}
                placeholder="Ex.: Escolha uma opção"
              />
            </div>
            <div>
              <Label>Tipo</Label>
              <Select
                value={group.selection_type || "single"}
                onValueChange={(selection_type) => onChange({ ...group, selection_type })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SELECTION_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="sm:col-span-2">
              <Label>Descrição</Label>
              <Textarea
                rows={2}
                value={group.description || ""}
                onChange={(event) => onChange({ ...group, description: event.target.value })}
                placeholder="Texto opcional para orientar a escolha"
              />
            </div>
            <div className="sm:col-span-2">
              <Label>Texto de destaque</Label>
              <Input
                value={group.highlight_text || ""}
                onChange={(event) => onChange({ ...group, highlight_text: event.target.value })}
                placeholder="Ex.: Adicione Nutella por R$ 4,00"
              />
            </div>
            <div>
              <Label>Mínimo de escolhas</Label>
              <Input
                type="number"
                min="0"
                step="1"
                value={group.min_selections ?? 0}
                onChange={(event) => onChange({ ...group, min_selections: event.target.value })}
              />
            </div>
            <div>
              <Label>Máximo de escolhas</Label>
              <Input
                type="number"
                min="0"
                step="1"
                value={group.max_selections ?? 1}
                onChange={(event) => onChange({ ...group, max_selections: event.target.value })}
              />
              {hasInvalidRange && (
                <p className="mt-1 text-xs text-red-600">O máximo não pode ser menor que o mínimo.</p>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4 rounded-lg border border-stone-200 bg-white px-3 py-2">
            <label className="flex items-center gap-2 text-sm">
              <Switch
                checked={group.required === true}
                onCheckedChange={(required) => onChange({ ...group, required })}
              />
              Obrigatório
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Switch
                checked={group.active !== false}
                onCheckedChange={(active) => onChange({ ...group, active })}
              />
              Ativo
            </label>
            {group.active === false && (
              <span className="rounded-full bg-stone-200 px-2 py-0.5 text-xs font-medium text-stone-700">
                Grupo indisponível
              </span>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-medium text-stone-900">Opções</p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addOption}
                className="h-8 rounded-lg"
              >
                <Plus className="mr-1.5 h-3.5 w-3.5" /> Nova opção
              </Button>
            </div>
            {options.length === 0 ? (
              <div className="rounded-lg border border-dashed border-stone-300 bg-white p-4 text-center text-sm text-stone-500">
                Nenhuma opção cadastrada.
              </div>
            ) : (
              <div className="space-y-2">
                {options.map((option, optionIndex) => (
                  <ProductOptionEditor
                    key={option.id || `${option.order}-${optionIndex}`}
                    option={option}
                    index={optionIndex}
                    total={options.length}
                    onChange={(nextOption) => updateOption(optionIndex, nextOption)}
                    onMove={moveOption}
                    onRemove={() => removeOption(optionIndex)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex shrink-0 gap-2 sm:flex-col">
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={onDuplicate}
            className="h-8 w-8"
            aria-label={`Duplicar grupo ${group.name || ""}`}
          >
            <Copy className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={onRemove}
            className="h-8 w-8 text-red-600 hover:bg-red-50 hover:text-red-700"
            aria-label={`Excluir grupo ${group.name || ""}`}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
