export const stripOptionGroupIds = (groups = []) =>
  groups.map((group, groupIndex) => ({
    name: group.name || "",
    description: group.description || "",
    highlight_text: group.highlight_text || "",
    required: group.required === true,
    min_selections: group.min_selections ?? 0,
    max_selections: group.max_selections ?? 1,
    selection_type: group.selection_type || "single",
    order: groupIndex,
    active: group.active !== false,
    options: (group.options || []).map((option, optionIndex) => ({
      name: option.name || "",
      description: option.description || "",
      additional_price: option.additional_price ?? 0,
      max_quantity: option.max_quantity ?? 1,
      order: optionIndex,
      active: option.active !== false,
      recommended: option.recommended === true,
      popular: option.popular === true,
    })),
  }));

export const duplicateOptionGroup = (group, order) => ({
  ...stripOptionGroupIds([group])[0],
  name: `${group.name || "Grupo"} (cópia)`,
  order,
});
