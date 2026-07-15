import { Copy, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import OptionGroupCard from "@/components/admin/OptionGroupCard";
import { duplicateOptionGroup } from "@/components/admin/productOptionUtils";

const newGroup = (order) => ({
  name: "",
  description: "",
  highlight_text: "",
  required: false,
  min_selections: 0,
  max_selections: 1,
  selection_type: "single",
  order,
  active: true,
  options: [],
});

function reorder(list, from, to) {
  if (to < 0 || to >= list.length) return list;
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next.map((entry, order) => ({ ...entry, order }));
}

export default function ProductOptionGroupsEditor({ value = [], onChange, onOpenCopyDialog }) {
  const groups = value || [];

  const addGroup = () => {
    onChange([...groups, newGroup(groups.length)]);
  };

  const updateGroup = (index, group) => {
    onChange(groups.map((current, currentIndex) => (currentIndex === index ? group : current)));
  };

  const moveGroup = (from, to) => {
    onChange(reorder(groups, from, to));
  };

  const removeGroup = (index) => {
    const group = groups[index];
    if ((group.options || []).length > 0) {
      const confirmed = window.confirm(`Excluir o grupo "${group.name || "sem nome"}" e todas as opções?`);
      if (!confirmed) return;
    }
    onChange(groups.filter((_, currentIndex) => currentIndex !== index)
      .map((current, order) => ({ ...current, order })));
  };

  const duplicateGroup = (index) => {
    const duplicated = duplicateOptionGroup(groups[index], groups.length);
    onChange([...groups, duplicated]);
  };

  return (
    <section className="space-y-3 rounded-xl border border-stone-200 p-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-sm font-semibold text-stone-900">Opções e adicionais</h3>
          <p className="text-xs text-stone-500">Configure escolhas e valores extras para este produto.</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          {onOpenCopyDialog && (
            <Button type="button" variant="outline" onClick={onOpenCopyDialog} className="h-9 rounded-lg">
              <Copy className="mr-1.5 h-4 w-4" /> Copiar opções de outro produto
            </Button>
          )}
          <Button type="button" variant="outline" onClick={addGroup} className="h-9 rounded-lg">
            <Plus className="mr-1.5 h-4 w-4" /> Criar grupo
          </Button>
        </div>
      </div>

      {groups.length === 0 ? (
        <div className="rounded-lg border border-dashed border-stone-300 bg-stone-50 p-5 text-center text-sm text-stone-500">
          Produtos sem grupos continuam funcionando normalmente.
        </div>
      ) : (
        <div className="space-y-3">
          {groups.map((group, index) => (
            <OptionGroupCard
              key={group.id || `${group.order}-${index}`}
              group={group}
              index={index}
              total={groups.length}
              onChange={(nextGroup) => updateGroup(index, nextGroup)}
              onMove={moveGroup}
              onRemove={() => removeGroup(index)}
              onDuplicate={() => duplicateGroup(index)}
            />
          ))}
        </div>
      )}
    </section>
  );
}
