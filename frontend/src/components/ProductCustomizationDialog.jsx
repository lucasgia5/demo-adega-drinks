import { useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, Minus, Plus, RotateCcw } from "lucide-react";
import { brl } from "@/lib/api";
import { useCart } from "@/context/CartContext";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
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

function ProductQuantityControl({ value, onDecrease, onIncrease, compact = false }) {
  const sizeClass = compact ? "h-9 w-9" : "h-10 w-10";
  return (
    <div className="inline-flex shrink-0 items-center rounded-xl border border-stone-200 bg-white">
      <button
        type="button"
        onClick={onDecrease}
        disabled={value <= 1}
        className={`grid ${sizeClass} place-items-center rounded-l-xl text-stone-700 hover:bg-stone-50 focus:outline-none focus:ring-2 focus:ring-brand/40 disabled:cursor-not-allowed disabled:opacity-35`}
        aria-label="Diminuir quantidade"
      >
        <Minus className="h-4 w-4" />
      </button>
      <span className="min-w-9 px-2 text-center text-sm font-semibold text-stone-900">{value}</span>
      <button
        type="button"
        onClick={onIncrease}
        className={`grid ${sizeClass} place-items-center rounded-r-xl text-stone-700 hover:bg-stone-50 focus:outline-none focus:ring-2 focus:ring-brand/40`}
        aria-label="Aumentar quantidade"
      >
        <Plus className="h-4 w-4" />
      </button>
    </div>
  );
}

function OptionQuantityControl({ value, max, canIncrease, onDecrease, onIncrease }) {
  return (
    <div className="inline-flex shrink-0 items-center rounded-lg border border-stone-200 bg-white">
      <button
        type="button"
        onClick={onDecrease}
        disabled={value <= 0}
        className="grid h-9 w-9 place-items-center rounded-l-lg text-stone-600 hover:bg-stone-50 focus:outline-none focus:ring-2 focus:ring-brand/40 disabled:cursor-not-allowed disabled:opacity-35"
        aria-label="Diminuir opção"
      >
        <Minus className="h-3.5 w-3.5" />
      </button>
      <span className="min-w-8 px-2 text-center text-sm font-semibold text-stone-900">{value}</span>
      <button
        type="button"
        onClick={onIncrease}
        disabled={value >= max || !canIncrease}
        className="grid h-9 w-9 place-items-center rounded-r-lg text-stone-600 hover:bg-stone-50 focus:outline-none focus:ring-2 focus:ring-brand/40 disabled:cursor-not-allowed disabled:opacity-35"
        aria-label="Aumentar opção"
      >
        <Plus className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function OptionBadges({ option }) {
  if (option.popular !== true && option.recommended !== true) return null;
  return (
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
  );
}

function ProductOptionRow({
  group,
  option,
  optionQty,
  limitReached,
  canAddMore,
  onSingle,
  onMultiple,
  onQuantity,
}) {
  const isSelected = optionQty > 0;
  const hasAdditional = Number(option.additional_price || 0) > 0;
  const disabled = group.selection_type === "multiple" && !canAddMore && !isSelected;
  const optionMax = Number(option.max_quantity || 1);
  const rowClasses = `w-full rounded-xl border p-3 text-left transition focus-within:ring-2 focus-within:ring-brand/30 ${
    isSelected
      ? "border-brand bg-brand/5"
      : hasAdditional
        ? "border-amber-200 bg-amber-50/40"
        : "border-stone-200 bg-white"
  } ${disabled ? "opacity-55" : ""}`;
  const priceNode = hasAdditional ? (
    <span className="shrink-0 whitespace-nowrap text-sm font-semibold text-brand">+ {brl(option.additional_price)}</span>
  ) : (
    <span className="shrink-0 whitespace-nowrap text-xs font-medium text-stone-400">Incluso</span>
  );

  const label = (
    <span className="min-w-0 flex-1">
      <span className="block break-words text-sm font-medium leading-snug text-stone-900">{option.name}</span>
      <OptionBadges option={option} />
      {option.description && (
        <span className="mt-1 block break-words text-xs leading-relaxed text-stone-500">{option.description}</span>
      )}
    </span>
  );

  if (group.selection_type === "quantity") {
    return (
      <div className={rowClasses}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 flex-1 items-start justify-between gap-3">
            {label}
            {priceNode}
          </div>
          <OptionQuantityControl
            value={optionQty}
            max={optionMax}
            canIncrease={optionQty < optionMax && (!limitReached || isSelected)}
            onDecrease={() => onQuantity(group, option, optionQty - 1)}
            onIncrease={() => onQuantity(group, option, optionQty + 1)}
          />
        </div>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => {
        if (group.selection_type === "single") onSingle(group, option);
        if (group.selection_type === "multiple") onMultiple(group, option);
      }}
      disabled={disabled}
      className={`${rowClasses} focus:outline-none`}
      aria-pressed={isSelected}
    >
      <span className="flex min-w-0 items-center gap-3">
        {label}
        <span className="flex shrink-0 items-center gap-3">
          {priceNode}
          <span
            className={`grid h-6 w-6 shrink-0 place-items-center rounded-full border ${
              isSelected ? "border-brand bg-brand" : "border-stone-300 bg-white"
            }`}
            aria-hidden="true"
          >
            {isSelected && <span className="h-2.5 w-2.5 rounded-full bg-white" />}
          </span>
        </span>
      </span>
    </button>
  );
}

function OptionGroupSection({
  group,
  groupSelected,
  highlighted,
  groupRef,
  onSingle,
  onMultiple,
  onQuantity,
}) {
  const count = groupCount(group, groupSelected);
  const maxSelections = Number(group.max_selections || 0);
  const minSelections = requiredMinimum(group);
  const limitReached = maxSelections > 0 && count >= maxSelections;
  const incomplete = minSelections > 0 && !isGroupComplete(group, groupSelected);
  const statusText = `${count} de ${maxSelections || "sem limite"} selecionado${count === 1 ? "" : "s"}${limitReached ? " - limite atingido" : ""}`;

  return (
    <section
      ref={groupRef}
      aria-invalid={highlighted && incomplete ? "true" : undefined}
      aria-describedby={`${group.id}-status`}
      className={`rounded-xl border bg-white p-4 shadow-sm transition sm:p-5 ${
        highlighted && incomplete
          ? "border-red-300 ring-2 ring-red-100"
          : incomplete
            ? "border-stone-200"
            : "border-stone-200"
      }`}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="break-words text-base font-semibold leading-snug text-stone-900">{group.name}</h3>
            {minSelections > 0 ? (
              <span className="rounded-full bg-brand/10 px-2 py-1 text-xs font-semibold text-brand">Obrigatório</span>
            ) : (
              <span className="rounded-full bg-stone-100 px-2 py-1 text-xs font-semibold text-stone-600">Opcional</span>
            )}
            {minSelections > 0 && !incomplete && (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-800">
                <CheckCircle2 className="h-3.5 w-3.5" /> Completo
              </span>
            )}
          </div>
          {group.description && <p className="mt-1 break-words text-sm leading-relaxed text-stone-500">{group.description}</p>}
          {group.highlight_text && (
            <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm font-medium leading-relaxed text-amber-900">
              {group.highlight_text}
            </p>
          )}
        </div>
        <span
          id={`${group.id}-status`}
          className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${
            limitReached ? "bg-amber-100 text-amber-800" : "bg-stone-100 text-stone-700"
          }`}
        >
          {statusText}
        </span>
      </div>
      {highlighted && incomplete && (
        <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700" role="alert">
          Escolha pelo menos {minSelections} opção{minSelections === 1 ? "" : "ões"} neste grupo.
        </p>
      )}
      <div className="mt-4 space-y-2.5">
        {group.options.map((option) => {
          const optionQty = Number(groupSelected[option.id] || 0);
          const isSelected = optionQty > 0;
          const canAddMore = !limitReached || isSelected;
          return (
            <ProductOptionRow
              key={option.id}
              group={group}
              option={option}
              optionQty={optionQty}
              limitReached={limitReached}
              canAddMore={canAddMore}
              onSingle={onSingle}
              onMultiple={onMultiple}
              onQuantity={onQuantity}
            />
          );
        })}
      </div>
    </section>
  );
}

function CustomizationSummary({
  selectedOptions,
  basePrice,
  unitPrice,
  quantity,
  total,
  onClear,
  compact = false,
}) {
  const grouped = selectedOptions.reduce((acc, option) => {
    acc[option.group_id] = acc[option.group_id] || { name: option.group_name, options: [] };
    acc[option.group_id].options.push(option);
    return acc;
  }, {});

  return (
    <section className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm sm:p-5" aria-label="Resumo da personalização">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-base font-semibold text-stone-900">Resumo</h3>
        <Button type="button" variant="ghost" size="sm" onClick={onClear} className="h-8 rounded-lg px-2 text-stone-600">
          <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> Limpar
        </Button>
      </div>
      <div className="mt-4 space-y-3 text-sm">
        <div className="flex items-center justify-between gap-4 text-stone-600">
          <span>Preço base</span>
          <span className="shrink-0 font-medium text-stone-900">{brl(basePrice)}</span>
        </div>
        {selectedOptions.length === 0 ? (
          <p className="rounded-lg bg-stone-50 px-3 py-2 text-xs text-stone-500">Nenhuma opção selecionada.</p>
        ) : (
          Object.entries(grouped).map(([groupId, group]) => (
            <div key={groupId} className="space-y-1.5">
              <p className="break-words text-xs font-semibold uppercase text-stone-500">{group.name}</p>
              {group.options.map((option) => {
                const additional = Number(option.additional_price || 0) * Number(option.quantity || 1);
                return (
                  <div key={`${option.group_id}:${option.option_id}`} className="flex items-start justify-between gap-3 text-stone-700">
                    <span className="min-w-0 break-words">
                      {option.quantity > 1 ? `${option.quantity}x ` : ""}{option.option_name}
                    </span>
                    <span className="shrink-0 whitespace-nowrap font-medium">
                      {additional > 0 ? `+ ${brl(additional)}` : "Incluso"}
                    </span>
                  </div>
                );
              })}
            </div>
          ))
        )}
        <div className="space-y-2 border-t border-stone-100 pt-3">
          <div className="flex items-center justify-between gap-4 text-stone-600">
            <span>Unitário</span>
            <span className="shrink-0 font-semibold text-stone-900">{brl(unitPrice)}</span>
          </div>
          <div className="flex items-center justify-between gap-4 text-stone-600">
            <span>Quantidade</span>
            <span className="shrink-0 font-semibold text-stone-900">{quantity}</span>
          </div>
          <div className={`flex items-center justify-between gap-4 font-semibold text-brand ${compact ? "text-lg" : "text-xl"}`}>
            <span>Total</span>
            <span className="shrink-0">{brl(total)}</span>
          </div>
        </div>
      </div>
    </section>
  );
}

function CustomizationFooter({ quantity, total, firstIncompleteGroup, onDecrease, onIncrease, onAdd }) {
  const buttonLabel = firstIncompleteGroup
    ? `Escolha ${firstIncompleteGroup.name}`
    : `Adicionar - ${brl(total)}`;

  return (
    <div className="border-t border-stone-200 bg-white p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:p-4 lg:hidden">
      {firstIncompleteGroup && (
        <p className="mb-2 line-clamp-2 text-sm font-medium text-red-700">
          Escolha {firstIncompleteGroup.name} para continuar.
        </p>
      )}
      <div className="flex items-center gap-3">
        <ProductQuantityControl
          value={quantity}
          onDecrease={onDecrease}
          onIncrease={onIncrease}
          compact
        />
        <Button
          type="button"
          onClick={onAdd}
          aria-disabled={!!firstIncompleteGroup}
          className={`h-12 min-w-0 flex-1 rounded-xl px-3 text-sm font-semibold ${
            firstIncompleteGroup
              ? "bg-stone-300 text-stone-700 hover:bg-stone-300"
              : "bg-brand text-white hover:bg-brand-dark"
          }`}
        >
          <span className="truncate">{buttonLabel}</span>
        </Button>
      </div>
    </div>
  );
}

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

  const decreaseQty = () => setQty((current) => Math.max(1, current - 1));
  const increaseQty = () => setQty((current) => current + 1);

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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="left-0 top-0 flex h-[100dvh] w-screen max-w-none translate-x-0 translate-y-0 grid-rows-none flex-col overflow-hidden rounded-none border-0 bg-brand-cream p-0 shadow-2xl sm:left-[50%] sm:top-[50%] sm:h-[min(90vh,820px)] sm:w-[calc(100vw-2rem)] sm:max-w-[1020px] sm:translate-x-[-50%] sm:translate-y-[-50%] sm:rounded-2xl sm:border [&>button]:right-3 [&>button]:top-3 [&>button]:z-20 [&>button]:h-11 [&>button]:w-11 [&>button]:rounded-full [&>button]:bg-white [&>button]:shadow-sm sm:[&>button]:right-4 sm:[&>button]:top-4">
        <DialogHeader className="shrink-0 border-b border-stone-200 bg-white px-4 py-4 pr-16 text-left sm:px-6">
          <div className="flex min-w-0 gap-4">
            {product?.image_url && (
              <div className="hidden h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-stone-100 sm:block">
                <img src={product.image_url} alt={product.name} className="h-full w-full object-cover" />
              </div>
            )}
            <div className="min-w-0">
              <DialogTitle className="break-words pr-1 font-serif text-2xl leading-tight text-stone-900 sm:text-3xl">
                {product?.name}
              </DialogTitle>
              {product?.description && (
                <DialogDescription className="mt-1 line-clamp-2 break-words text-sm leading-relaxed text-stone-500">
                  {product.description}
                </DialogDescription>
              )}
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                <span className="font-medium text-stone-700">Preço base: {brl(basePrice)}</span>
                {additionalTotal > 0 && <span className="font-medium text-brand">Adicionais: + {brl(additionalTotal)}</span>}
              </div>
            </div>
          </div>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-4 py-4 pb-28 sm:px-6 lg:pb-6">
          <div className="mx-auto grid max-w-[960px] grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
            <main className="min-w-0 space-y-4">
              {product?.image_url && (
                <div className="overflow-hidden rounded-xl bg-stone-100 sm:hidden">
                  <img src={product.image_url} alt={product.name} className="aspect-[4/3] w-full object-cover" />
                </div>
              )}
              {groups.map((group) => (
                <OptionGroupSection
                  key={group.id}
                  group={group}
                  groupSelected={selected[group.id] || {}}
                  highlighted={highlightedGroupId === group.id}
                  groupRef={(node) => { groupRefs.current[group.id] = node; }}
                  onSingle={toggleSingle}
                  onMultiple={toggleMultiple}
                  onQuantity={setOptionQty}
                />
              ))}
              <section className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm sm:p-5">
                <label htmlFor="item-observation" className="text-sm font-semibold text-stone-900">Observação do item</label>
                <Textarea
                  id="item-observation"
                  rows={3}
                  value={itemObservation}
                  onChange={(event) => setItemObservation(event.target.value)}
                  placeholder="Ex.: Pouco leite condensado"
                  className="mt-2 min-h-32 resize-none"
                />
              </section>
              <div className="lg:hidden">
                <CustomizationSummary
                  selectedOptions={currentSelectedOptions}
                  basePrice={basePrice}
                  unitPrice={unitPrice}
                  quantity={qty}
                  total={total}
                  onClear={clearChoices}
                  compact
                />
              </div>
            </main>

            <aside className="hidden min-w-0 lg:block">
              <div className="sticky top-0 space-y-4">
                <CustomizationSummary
                  selectedOptions={currentSelectedOptions}
                  basePrice={basePrice}
                  unitPrice={unitPrice}
                  quantity={qty}
                  total={total}
                  onClear={clearChoices}
                />
                <section className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm">
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-sm font-medium text-stone-700">Quantidade</span>
                    <ProductQuantityControl value={qty} onDecrease={decreaseQty} onIncrease={increaseQty} />
                  </div>
                  {firstIncompleteGroup && (
                    <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
                      Escolha {firstIncompleteGroup.name} para continuar.
                    </p>
                  )}
                  <Button
                    type="button"
                    onClick={addToCart}
                    aria-disabled={!!firstIncompleteGroup}
                    className={`mt-4 h-12 w-full rounded-xl font-semibold ${
                      firstIncompleteGroup
                        ? "bg-stone-300 text-stone-700 hover:bg-stone-300"
                        : "bg-brand text-white hover:bg-brand-dark"
                    }`}
                  >
                    {firstIncompleteGroup ? "Completar escolhas" : `Adicionar - ${brl(total)}`}
                  </Button>
                </section>
              </div>
            </aside>
          </div>
        </div>

        <CustomizationFooter
          quantity={qty}
          total={total}
          firstIncompleteGroup={firstIncompleteGroup}
          onDecrease={decreaseQty}
          onIncrease={increaseQty}
          onAdd={addToCart}
        />
      </DialogContent>
    </Dialog>
  );
}
