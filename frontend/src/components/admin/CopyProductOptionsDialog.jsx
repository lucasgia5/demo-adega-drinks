import { useMemo, useState } from "react";
import { Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { stripOptionGroupIds } from "@/components/admin/productOptionUtils";

export default function CopyProductOptionsDialog({
  open,
  onOpenChange,
  products,
  currentProductId,
  currentGroups,
  onApply,
}) {
  const candidates = useMemo(
    () => products.filter((product) => product.id !== currentProductId && (product.option_groups || []).length > 0),
    [products, currentProductId]
  );
  const [sourceProductId, setSourceProductId] = useState("");
  const [selectedGroupIds, setSelectedGroupIds] = useState([]);
  const [mode, setMode] = useState("append");

  const sourceProduct = candidates.find((product) => product.id === sourceProductId);
  const sourceGroups = sourceProduct?.option_groups || [];

  const chooseProduct = (productId) => {
    setSourceProductId(productId);
    const product = candidates.find((item) => item.id === productId);
    setSelectedGroupIds((product?.option_groups || []).map((group, index) => group.id || `group-${index}`));
  };

  const groupKey = (group, index) => group.id || `group-${index}`;

  const toggleGroup = (group, index) => {
    const key = groupKey(group, index);
    setSelectedGroupIds((current) =>
      current.includes(key)
        ? current.filter((item) => item !== key)
        : [...current, key]
    );
  };

  const apply = () => {
    if (!sourceProduct || selectedGroupIds.length === 0) return;
    if (mode === "replace" && (currentGroups || []).length > 0) {
      const confirmed = window.confirm("Substituir os grupos existentes deste produto?");
      if (!confirmed) return;
    }
    const groupsToCopy = sourceGroups.filter((group, index) =>
      selectedGroupIds.includes(groupKey(group, index))
    );
    const clonedGroups = stripOptionGroupIds(groupsToCopy);
    onApply({ groups: clonedGroups, mode });
    setSourceProductId("");
    setSelectedGroupIds([]);
    setMode("append");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl">Copiar opções de outro produto</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>Produto de origem</Label>
            <Select value={sourceProductId} onValueChange={chooseProduct}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione um produto" />
              </SelectTrigger>
              <SelectContent>
                {candidates.map((product) => (
                  <SelectItem key={product.id} value={product.id}>
                    {product.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {candidates.length === 0 && (
              <p className="mt-2 text-xs text-stone-500">Nenhum outro produto com grupos cadastrados.</p>
            )}
          </div>

          {sourceProduct && (
            <div className="space-y-3">
              <div className="rounded-lg border border-stone-200 bg-stone-50 p-3">
                <p className="text-sm font-medium text-stone-900">Grupos disponíveis</p>
                <div className="mt-2 space-y-2">
                  {sourceGroups.map((group, index) => {
                    const key = groupKey(group, index);
                    return (
                      <label key={key} className="flex items-start gap-3 rounded-lg bg-white p-3 text-sm">
                        <Checkbox
                          checked={selectedGroupIds.includes(key)}
                          onCheckedChange={() => toggleGroup(group, index)}
                          className="mt-0.5"
                        />
                        <span className="min-w-0">
                          <span className="block font-medium text-stone-900">{group.name || "Grupo sem nome"}</span>
                          <span className="block text-xs text-stone-500">
                            {(group.options || []).length} opções · {group.active === false ? "inativo" : "ativo"}
                          </span>
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <RadioGroup value={mode} onValueChange={setMode} className="grid gap-2 sm:grid-cols-2">
                <label className="flex items-center gap-2 rounded-lg border border-stone-200 p-3 text-sm">
                  <RadioGroupItem value="append" />
                  Acrescentar aos grupos atuais
                </label>
                <label className="flex items-center gap-2 rounded-lg border border-stone-200 p-3 text-sm">
                  <RadioGroupItem value="replace" />
                  Substituir grupos atuais
                </label>
              </RadioGroup>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button
            type="button"
            onClick={apply}
            disabled={!sourceProduct || selectedGroupIds.length === 0}
            className="bg-brand text-white hover:bg-brand-dark"
          >
            <Copy className="mr-1.5 h-4 w-4" /> Copiar opções
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
