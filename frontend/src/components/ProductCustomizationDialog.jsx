import { useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, Minus, Plus, RotateCcw } from "lucide-react";
import { brl } from "@/lib/api";
import { useCart } from "@/context/CartContext";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";

const EMPTY_SELECTED_OPTIONS = [];

export function activeOptionGroups(product) {
  return (product?.option_groups || [])
    .filter((group) => group.active !== false)
    .map((group) => ({
      ...group,
      options: (group.options || [])
        .filter((option) => option.active !== false)
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
    }))
    .filter((group) => group.options.length > 0)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

const effectivePrice = (product) =>
  product?.promo_active && product?.promo_price != null
    ? Number(product.promo_price)
    : Number(product?.price || 0);

const requiredMinimum = (group) =>
  Math.max(Number(group.min_selections || 0), group.required ? 1 : 0);

const groupCount = (group, selected) => {
  const values = Object.values(selected || {});
  if (group.selection_type === "quantity") {
    return values.reduce((sum, qty) => sum + Number(qty || 0), 0);
  }
  return values.length;
};

const isGroupComplete = (group, selected) => groupCount(group, selected) >= requiredMinimum(group);

export default function ProductCustomizationDialog({
  product,
  open,
  onOpenChange,
  initialQuantity = 1,
  initialSelectedOptions = EMPTY_SELECTED_OPTIONS,
  initialObservation = "",
  onConfirm,
}) {
  const { addCustomized } = useCart();
  const [selected, setSelected] = useState({});
  const [qty, setQty] = useState(initialQuantity);
  const [itemObservation, setItemObservation] = useState(initialObservation);
  const [highlightedGroupId, setHighlightedGroupId] = useState("");
  const initializedKeyRef = useRef("");
  const groupRefs = useRef({});

  const groups = useMemo(() => activeOptionGroups(product), [product]);
  const basePrice = effectivePrice(product);

  useEffect(() => {
    if (!open) return;
    const initKey = onConfirm
      ? `${product?.id || ""}:edit:${JSON.stringify(initialSelectedOptions)}:${initialObservation}`
      : `${product?.id || ""}:new`;
    if (initializedKeyRef.current === initKey) return;
    const initialSelected = {};
    initialSelectedOptions.forEach((option) => {
      initialSelected[option.group_id] = {
        ...(initialSelected[option.group_id] || {}),
        [option.option_id]: Number(option.quantity || 1),
      };
    });
    setSelected(initialSelected);
    setQty(Math.max(1, Number(initialQuantity || 1)));
    setItemObservation(initialObservation || "");
    setHighlightedGroupId("");
    initializedKeyRef.current = initKey;
  }, [open, initialQuantity, initialObservation, initialSelectedOptions, onConfirm, product?.id]);

  const additionalTotal = useMemo(() => {
    return groups.reduce((sum, group) => {
      const groupSelected = selected[group.id] || {};
      return sum + group.options.reduce((optionSum, option) => {
        const optionQty = Number(groupSelected[option.id] || 0);
        return optionSum + optionQty * Number(option.additional_price || 0);
      }, 0);
    }, 0);
  }, [groups, selected]);

  const unitPrice = basePrice + additionalTotal;
  const total = unitPrice * qty;
  const firstIncompleteGroup = groups.find((group) =>
    requiredMinimum(group) > 0 && !isGroupComplete(group, selected[group.id])
  );

  const setOptionQty = (group, option, optionQty) => {
    const currentGroup = selected[group.id] || {};
    const currentQty = Number(currentGroup[option.id] || 0);
    const nextQty = Math.max(0, Math.min(Number(option.max_quantity || 1), optionQty));
    const maxSelections = Number(group.max_selections || 0);
    const currentCount = groupCount(group, currentGroup);
    const projectedCount = currentCount - currentQty + nextQty;

    if (nextQty > currentQty && maxSelections > 0 && projectedCount > maxSelections) return;

    const nextGroup = { ...currentGroup };
    if (nextQty <= 0) delete nextGroup[option.id];
    else nextGroup[option.id] = nextQty;
    setSelected((current) => ({ ...current, [group.id]: nextGroup }));
  };

  const toggleSingle = (group, option) => {
    const currentGroup = selected[group.id] || {};
    const isSelected = currentGroup[option.id] > 0;
    setSelected((current) => ({
      ...current,
      [group.id]: isSelected ? {} : { [option.id]: 1 },
    }));
  };

  const toggleMultiple = (group, option) => {
    const currentGroup = selected[group.id] || {};
    const isSelected = currentGroup[option.id] > 0;
    if (isSelected) {
      const nextGroup = { ...currentGroup };
      delete nextGroup[option.id];
      setSelected((current) => ({ ...current, [group.id]: nextGroup }));
      return;
    }
    const maxSelections = Number(group.max_selections || 0);
    if (maxSelections > 0 && groupCount(group, currentGroup) >= maxSelections) return;
    setSelected((current) => ({ ...current, [group.id]: { ...currentGroup, [option.id]: 1 } }));
  };

  const selectedOptions = () =>
    groups.flatMap((group) => {
      const groupSelected = selected[group.id] || {};
      return group.options
        .filter((option) => Number(groupSelected[option.id] || 0) > 0)
        .map((option) => ({
          group_id: group.id,
          group_name: group.name,
          option_id: option.id,
          option_name: option.name,
          quantity: Number(groupSelected[option.id]),
          additional_price: Number(option.additional_price || 0),
        }));
    });

  const currentSelectedOptions = selectedOptions();

  const addToCart = () => {
    if (firstIncompleteGroup) {
      setHighlightedGroupId(firstIncompleteGroup.id);
      groupRefs.current[firstIncompleteGroup.id]?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }

    const customization = {
      quantity: qty,
      unit_price: unitPrice,
      selected_options: selectedOptions(),
      item_observation: itemObservation.trim(),
    };
    if (onConfirm) onConfirm(customization);
    else addCustomized(product, customization);
    setSelected({});
    setQty(1);
    setItemObservation("");
    setHighlightedGroupId("");
    initializedKeyRef.current = "";
    onOpenChange(false);
  };

  const clearChoices = () => {
    setSelected({});
    setItemObservation("");
    setHighlightedGroupId("");
  };

  const buttonLabel = firstIncompleteGroup
    ? `Escolha ${firstIncompleteGroup.name} para continuar`
    : `Adicionar ao carrinho - ${brl(total)}`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92vh] w-[calc(100vw-1rem)] max-w-2xl grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden rounded-xl bg-brand-cream p-0 sm:w-full">
        <DialogHeader className="border-b border-stone-200 bg-white px-5 py-4 pr-12 text-left">
          <DialogTitle className="font-serif text-2xl text-stone-900">{product?.name}</DialogTitle>
          <div className="mt-1 flex flex-wrap gap-2 text-sm text-stone-500">
            <span>Preço base: {brl(basePrice)}</span>
            <span>Adicionais: {brl(additionalTotal)}</span>
          </div>
        </DialogHeader>

        <div className="min-h-0 overflow-y-auto px-4 py-4 pb-28 sm:px-5">
          <div className="space-y-4">
            {groups.map((group) => {
              const groupSelected = selected[group.id] || {};
              const count = groupCount(group, groupSelected);
              const maxSelections = Number(group.max_selections || 0);
              const limitReached = maxSelections > 0 && count >= maxSelections;
              const incomplete = requiredMinimum(group) > 0 && !isGroupComplete(group, groupSelected);
              return (
                <section
                  key={group.id}
                  ref={(node) => { groupRefs.current[group.id] = node; }}
                  className={`rounded-xl border bg-white p-4 ${
                    highlightedGroupId === group.id && incomplete
                      ? "border-red-300 ring-2 ring-red-100"
                      : "border-stone-200"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-medium text-stone-900">{group.name}</h3>
                      {group.description && <p className="mt-1 text-sm text-stone-500">{group.description}</p>}
                      {group.highlight_text && (
                        <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-sm font-medium text-amber-900">
                          {group.highlight_text}
                        </p>
                      )}
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                        {requiredMinimum(group) > 0 ? (
                          <span className="rounded-full bg-brand/10 px-2 py-1 font-medium text-brand">Obrigatório</span>
                        ) : (
                          <span className="rounded-full bg-stone-100 px-2 py-1 font-medium text-stone-600">Opcional</span>
                        )}
                        {limitReached && (
                          <span className="rounded-full bg-amber-100 px-2 py-1 font-medium text-amber-800">
                            Limite atingido
                          </span>
                        )}
                        {requiredMinimum(group) > 0 && !incomplete && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-1 font-medium text-emerald-800">
                            <CheckCircle2 className="h-3 w-3" /> Completo
                          </span>
                        )}
                      </div>
                    </div>
                    <span className="shrink-0 rounded-full bg-stone-100 px-2.5 py-1 text-xs font-semibold text-stone-700">
                      {count} de {maxSelections || "sem limite"}
                    </span>
                  </div>

                  <div className="mt-4 space-y-2">
                    {limitReached && (
                      <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
                        Limite de {maxSelections} escolha(s) atingido. Remova uma opção para escolher outra.
                      </p>
                    )}
                    {group.options.map((option) => {
                      const optionQty = Number(groupSelected[option.id] || 0);
                      const isSelected = optionQty > 0;
                      const optionMax = Number(option.max_quantity || 1);
                      const canAddMore = !limitReached || isSelected;
                      return (
                        <div
                          key={option.id}
                          className={`rounded-lg border p-3 ${
                            isSelected
                              ? "border-brand bg-brand/5"
                              : Number(option.additional_price || 0) > 0
                                ? "border-amber-200 bg-amber-50/40"
                                : "border-stone-200 bg-white"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <button
                              type="button"
                              onClick={() => {
                                if (group.selection_type === "single") toggleSingle(group, option);
                                if (group.selection_type === "multiple") toggleMultiple(group, option);
                              }}
                              disabled={
                                group.selection_type === "quantity" ||
                                (group.selection_type === "multiple" && !canAddMore && !isSelected)
                              }
                              className="min-w-0 flex-1 text-left disabled:cursor-not-allowed"
                            >
                              <span className="block font-medium text-stone-900">{option.name}</span>
                              <span className="mt-1 flex flex-wrap gap-1">
                                {option.popular === true && (
                                  <span className="rounded-full bg-brand/10 px-2 py-0.5 text-[10px] font-semibold text-brand">
                                    Mais pedido
                                  </span>
                                )}
                                {option.recommended === true && (
                                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-800">
                                    Recomendado
                                  </span>
                                )}
                              </span>
                              {option.description && <span className="block text-xs text-stone-500">{option.description}</span>}
                            </button>
                            <div className="flex shrink-0 items-center gap-3">
                              {Number(option.additional_price || 0) > 0 && (
                                <span className="text-sm font-medium text-brand">
                                  + {brl(option.additional_price)}
                                </span>
                              )}
                              {group.selection_type === "quantity" ? (
                                <div className="inline-flex items-center rounded-lg border border-stone-200">
                                  <button
                                    type="button"
                                    onClick={() => setOptionQty(group, option, optionQty - 1)}
                                    className="grid h-8 w-8 place-items-center text-stone-600 hover:bg-stone-50"
                                    aria-label="Diminuir opção"
                                  >
                                    <Minus className="h-3.5 w-3.5" />
                                  </button>
                                  <span className="w-8 text-center text-sm font-semibold">{optionQty}</span>
                                  <button
                                    type="button"
                                    onClick={() => setOptionQty(group, option, optionQty + 1)}
                                    disabled={optionQty >= optionMax || (limitReached && optionQty === 0)}
                                    className="grid h-8 w-8 place-items-center text-stone-600 hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-35"
                                    aria-label="Aumentar opção"
                                  >
                                    <Plus className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              ) : (
                                <span
                                  className={`grid h-5 w-5 place-items-center rounded-full border ${
                                    isSelected ? "border-brand bg-brand" : "border-stone-300 bg-white"
                                  }`}
                                >
                                  {isSelected && <span className="h-2 w-2 rounded-full bg-white" />}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              );
            })}
          </div>
          <div className="mt-4 rounded-xl border border-stone-200 bg-white p-4">
            <label className="text-sm font-medium text-stone-900">Observação do item</label>
            <Textarea
              rows={2}
              value={itemObservation}
              onChange={(event) => setItemObservation(event.target.value)}
              placeholder="Ex.: Pouco leite condensado"
              className="mt-2"
            />
          </div>
          <div className="mt-4 rounded-xl border border-stone-200 bg-white p-4">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold text-stone-900">Resumo</h3>
              <Button type="button" variant="outline" size="sm" onClick={clearChoices} className="h-8 rounded-lg">
                <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> Limpar escolhas
              </Button>
            </div>
            <div className="mt-3 space-y-1 text-sm text-stone-600">
              <div className="flex justify-between gap-3">
                <span>Preço base</span>
                <span>{brl(basePrice)}</span>
              </div>
              {currentSelectedOptions.length === 0 ? (
                <p className="text-xs text-stone-500">Nenhuma opção selecionada.</p>
              ) : (
                currentSelectedOptions.map((option) => {
                  const additional = Number(option.additional_price || 0) * Number(option.quantity || 1);
                  return (
                    <div key={`${option.group_id}:${option.option_id}`} className="flex justify-between gap-3">
                      <span>
                        {option.group_name}: {option.quantity > 1 ? `${option.quantity}x ` : ""}{option.option_name}
                      </span>
                      <span>{additional > 0 ? `+ ${brl(additional)}` : brl(0)}</span>
                    </div>
                  );
                })
              )}
              <div className="flex justify-between gap-3 border-t border-stone-100 pt-2 font-semibold text-stone-900">
                <span>Unitário final</span>
                <span>{brl(unitPrice)}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="sticky bottom-0 border-t border-stone-200 bg-white p-4">
          <div className="mb-3 flex items-center justify-between gap-4">
            <span className="text-sm text-stone-600">Quantidade</span>
            <div className="inline-flex items-center rounded-xl border border-stone-200">
              <button
                type="button"
                onClick={() => setQty((current) => Math.max(1, current - 1))}
                className="grid h-10 w-10 place-items-center hover:bg-stone-50"
                aria-label="Diminuir quantidade"
              >
                <Minus className="h-4 w-4" />
              </button>
              <span className="w-10 text-center font-semibold">{qty}</span>
              <button
                type="button"
                onClick={() => setQty((current) => current + 1)}
                className="grid h-10 w-10 place-items-center hover:bg-stone-50"
                aria-label="Aumentar quantidade"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
          </div>
          <Button
            type="button"
            onClick={addToCart}
            aria-disabled={!!firstIncompleteGroup}
            className={`h-12 w-full rounded-xl ${
              firstIncompleteGroup
                ? "bg-stone-300 text-stone-700 hover:bg-stone-300"
                : "bg-brand text-white hover:bg-brand-dark"
            }`}
          >
            {buttonLabel}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
