import { useEffect, useState } from "react";
import AdminLayout from "@/components/AdminLayout";
import api, { brl, formatApiErrorDetail } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { ArrowDown, ArrowUp, Copy, Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import ProductOptionGroupsEditor from "@/components/admin/ProductOptionGroupsEditor";
import CopyProductOptionsDialog from "@/components/admin/CopyProductOptionsDialog";
import { stripOptionGroupIds } from "@/components/admin/productOptionUtils";

const empty = {
  name: "", description: "", image_url: "", price: "",
  category_id: "", available: true, promo_active: false, promo_price: "",
  option_groups: [],
};

const toInt = (value, fallback = 0) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const toMoney = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const normalizeOptionGroups = (groups = []) =>
  groups.map((group, groupIndex) => ({
    ...(group.id ? { id: group.id } : {}),
    name: (group.name || "").trim(),
    description: group.description || "",
    highlight_text: group.highlight_text || "",
    required: group.required === true,
    min_selections: Math.max(0, toInt(group.min_selections, 0)),
    max_selections: Math.max(0, toInt(group.max_selections, 1)),
    selection_type: group.selection_type || "single",
    order: groupIndex,
    active: group.active !== false,
    options: (group.options || []).map((option, optionIndex) => ({
      ...(option.id ? { id: option.id } : {}),
      name: (option.name || "").trim(),
      description: option.description || "",
      additional_price: toMoney(option.additional_price),
      max_quantity: Math.max(1, toInt(option.max_quantity, 1)),
      order: optionIndex,
      active: option.active !== false,
      recommended: option.recommended === true,
      popular: option.popular === true,
    })),
  }));

const validateOptionGroups = (groups = []) => {
  for (const group of groups) {
    if (!group.name) return "Preencha o nome de todos os grupos de opções";
    if (group.max_selections < group.min_selections) {
      return `O máximo de escolhas não pode ser menor que o mínimo em "${group.name}"`;
    }
    for (const option of group.options || []) {
      if (option.additional_price < 0) return "Preço adicional não pode ser negativo";
    }
  }
  return "";
};

export default function Products() {
  const [products, setProducts] = useState([]);
  const [cats, setCats] = useState([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(empty);
  const [busy, setBusy] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [imagePreview, setImagePreview] = useState("");
  const [copyOptionsOpen, setCopyOptionsOpen] = useState(false);

  const load = async () => {
    const [{ data: ps }, { data: cs }] = await Promise.all([
      api.get("/products"),
      api.get("/categories"),
    ]);
    setProducts(ps);
    setCats(cs);
  };
  useEffect(() => { load(); }, []);

  const openNew = () => {
    setEditing(null);
    setForm({ ...empty, option_groups: [], category_id: cats[0]?.id || "" });
    setImagePreview("");
    setOpen(true);
  };
  const openEdit = (p) => {
    setEditing(p);
    setForm({
      name: p.name, description: p.description || "", image_url: p.image_url || "",
      price: String(p.price), category_id: p.category_id, available: p.available,
      promo_active: p.promo_active, promo_price: p.promo_price != null ? String(p.promo_price) : "",
      option_groups: p.option_groups || [],
    });
    setImagePreview(p.image_url || "");
    setOpen(true);
  };

  const uploadImage = async (file) => {
    if (!file) return;
    const previewUrl = URL.createObjectURL(file);
    setImagePreview(previewUrl);
    setUploadingImage(true);
    try {
      const data = new FormData();
      data.append("file", file);
      const res = await api.post("/admin/products/upload-image", data, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setForm((curr) => ({ ...curr, image_url: res.data.image_url }));
      setImagePreview(res.data.image_url);
      toast.success("Imagem enviada");
    } catch (e) {
      setImagePreview(form.image_url);
      toast.error(formatApiErrorDetail(e.response?.data?.detail) || "Erro ao enviar imagem");
    } finally {
      URL.revokeObjectURL(previewUrl);
      setUploadingImage(false);
    }
  };

  const save = async () => {
    if (!form.name.trim() || !form.category_id || !form.price) {
      toast.error("Preencha nome, categoria e preço");
      return;
    }
    const optionGroups = normalizeOptionGroups(form.option_groups || []);
    const optionGroupsError = validateOptionGroups(optionGroups);
    if (optionGroupsError) {
      toast.error(optionGroupsError);
      return;
    }
    setBusy(true);
    try {
      const payload = {
        name: form.name.trim(),
        description: form.description,
        image_url: form.image_url,
        price: Number(form.price),
        category_id: form.category_id,
        available: form.available,
        promo_active: form.promo_active,
        promo_price: form.promo_active && form.promo_price !== "" ? Number(form.promo_price) : null,
        option_groups: optionGroups,
      };
      if (editing) {
        await api.put(`/products/${editing.id}`, payload);
        toast.success("Produto atualizado");
      } else {
        await api.post("/products", payload);
        toast.success("Produto criado");
      }
      setOpen(false);
      await load();
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail) || "Erro ao salvar");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (p) => {
    if (!window.confirm(`Excluir "${p.name}"?`)) return;
    try {
      await api.delete(`/products/${p.id}`);
      toast.success("Produto excluído");
      await load();
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail) || "Erro");
    }
  };

  const catName = (id) => cats.find((c) => c.id === id)?.name || "—";

  const moveProduct = async (product, direction) => {
    try {
      const { data } = await api.post("/admin/products/reorder", {
        id: product.id,
        direction,
      });
      setProducts(data);
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail) || "Erro ao reordenar produto");
    }
  };

  const duplicateProduct = async (product) => {
    const confirmed = window.confirm(`Duplicar "${product.name}" mantendo os grupos de opções?`);
    if (!confirmed) return;
    try {
      const payload = {
        name: `${product.name} (cópia)`,
        description: product.description || "",
        image_url: product.image_url || "",
        price: Number(product.price || 0),
        category_id: product.category_id,
        available: product.available,
        promo_active: product.promo_active,
        promo_price: product.promo_active && product.promo_price != null ? Number(product.promo_price) : null,
        option_groups: normalizeOptionGroups(stripOptionGroupIds(product.option_groups || [])),
      };
      await api.post("/products", payload);
      toast.success("Produto duplicado");
      await load();
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail) || "Erro ao duplicar produto");
    }
  };

  const applyCopiedOptionGroups = ({ groups, mode }) => {
    const currentGroups = form.option_groups || [];
    const nextGroups = mode === "replace" ? groups : [...currentGroups, ...groups];
    setForm({
      ...form,
      option_groups: nextGroups.map((group, order) => ({ ...group, order })),
    });
    toast.success("Opções copiadas");
  };

  return (
    <AdminLayout
      title="Produtos"
      actions={
        <Button data-testid="new-product-btn" className="bg-brand hover:bg-brand-dark rounded-xl" onClick={openNew}>
          <Plus className="h-4 w-4 mr-1.5" /> Novo
        </Button>
      }
    >
      <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-stone-50 text-stone-500 uppercase tracking-wider text-xs">
            <tr>
              <th className="text-left p-3">Produto</th>
              <th className="text-left p-3 hidden md:table-cell">Categoria</th>
              <th className="text-left p-3">Preço</th>
              <th className="text-left p-3 hidden md:table-cell">Disponível</th>
              <th className="text-right p-3">Ações</th>
            </tr>
          </thead>
          <tbody data-testid="products-table">
            {products.length === 0 && (
              <tr><td colSpan={5} className="p-8 text-center text-stone-500">Nenhum produto cadastrado.</td></tr>
            )}
            {products.map((p, index) => (
              <tr key={p.id} className="border-t border-stone-100">
                <td className="p-3">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg overflow-hidden bg-stone-100 shrink-0">
                      {p.image_url && <img src={p.image_url} alt="" className="h-full w-full object-cover" />}
                    </div>
                    <div>
                      <p className="font-medium text-stone-900">{p.name}</p>
                      <p className="text-xs text-stone-500 md:hidden">{catName(p.category_id)}</p>
                    </div>
                  </div>
                </td>
                <td className="p-3 hidden md:table-cell text-stone-700">{catName(p.category_id)}</td>
                <td className="p-3">
                  {p.promo_active && p.promo_price != null ? (
                    <div>
                      <span className="text-xs text-stone-400 line-through decoration-red-500/50">{brl(p.price)}</span>
                      <span className="ml-2 font-semibold text-brand">{brl(p.promo_price)}</span>
                    </div>
                  ) : (
                    <span className="font-medium text-stone-900">{brl(p.price)}</span>
                  )}
                </td>
                <td className="p-3 hidden md:table-cell">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${p.available ? "bg-green-100 text-green-800" : "bg-stone-100 text-stone-600"}`}>
                    {p.available ? "Sim" : "Não"}
                  </span>
                </td>
                <td className="p-3 text-right">
                  <button
                    onClick={() => moveProduct(p, "up")}
                    disabled={index === 0}
                    data-testid={`move-product-up-${p.id}`}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg hover:bg-stone-100 disabled:cursor-not-allowed disabled:opacity-35"
                    aria-label={`Subir ${p.name}`}
                  >
                    <ArrowUp className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => moveProduct(p, "down")}
                    disabled={index === products.length - 1}
                    data-testid={`move-product-down-${p.id}`}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg hover:bg-stone-100 disabled:cursor-not-allowed disabled:opacity-35"
                    aria-label={`Descer ${p.name}`}
                  >
                    <ArrowDown className="h-4 w-4" />
                  </button>
                  <button onClick={() => openEdit(p)} data-testid={`edit-product-${p.id}`} className="inline-flex h-8 w-8 items-center justify-center rounded-lg hover:bg-stone-100">
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button onClick={() => duplicateProduct(p)} data-testid={`duplicate-product-${p.id}`} className="inline-flex h-8 w-8 items-center justify-center rounded-lg hover:bg-stone-100" aria-label={`Duplicar ${p.name}`}>
                    <Copy className="h-4 w-4" />
                  </button>
                  <button onClick={() => remove(p)} data-testid={`delete-product-${p.id}`} className="inline-flex h-8 w-8 items-center justify-center rounded-lg hover:bg-red-50 text-red-600">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-serif text-2xl">{editing ? "Editar produto" : "Novo produto"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Nome</Label>
              <Input data-testid="form-product-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <Label>Descrição</Label>
              <Textarea rows={3} data-testid="form-product-desc" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <div>
              <Label>URL da imagem</Label>
              <Input data-testid="form-product-image" placeholder="https://..." value={form.image_url} onChange={(e) => {
                setForm({ ...form, image_url: e.target.value });
                setImagePreview(e.target.value);
              }} />
            </div>
            <div className="space-y-2">
              <Label>Upload de imagem</Label>
              <Input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                data-testid="form-product-image-upload"
                onChange={(e) => uploadImage(e.target.files?.[0])}
                disabled={uploadingImage}
              />
              {uploadingImage && <p className="text-xs text-stone-500">Enviando imagem...</p>}
              {imagePreview && (
                <div className="h-28 w-28 overflow-hidden rounded-xl border border-stone-200 bg-stone-50">
                  <img src={imagePreview} alt="Prévia do produto" className="h-full w-full object-cover" />
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Preço</Label>
                <Input type="number" step="0.01" data-testid="form-product-price" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
              </div>
              <div>
                <Label>Categoria</Label>
                <Select value={form.category_id} onValueChange={(v) => setForm({ ...form, category_id: v })}>
                  <SelectTrigger data-testid="form-product-category"><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {cats.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex items-center justify-between rounded-xl border border-stone-200 p-3">
              <div>
                <p className="text-sm font-medium">Disponível</p>
                <p className="text-xs text-stone-500">Aparece para os clientes quando ativo.</p>
              </div>
              <Switch checked={form.available} onCheckedChange={(v) => setForm({ ...form, available: v })} data-testid="form-product-available" />
            </div>
            <div className="rounded-xl border border-stone-200 p-3 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Ativar promoção</p>
                  <p className="text-xs text-stone-500">Preço antigo riscado + preço promocional em destaque.</p>
                </div>
                <Switch checked={form.promo_active} onCheckedChange={(v) => setForm({ ...form, promo_active: v })} data-testid="form-product-promo" />
              </div>
              {form.promo_active && (
                <div>
                  <Label>Preço promocional</Label>
                  <Input type="number" step="0.01" data-testid="form-product-promo-price" value={form.promo_price} onChange={(e) => setForm({ ...form, promo_price: e.target.value })} />
                </div>
              )}
            </div>
            <ProductOptionGroupsEditor
              value={form.option_groups || []}
              onChange={(option_groups) => setForm({ ...form, option_groups })}
              onOpenCopyDialog={() => setCopyOptionsOpen(true)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button disabled={busy} onClick={save} data-testid="form-product-save" className="bg-brand hover:bg-brand-dark text-white">
              {busy ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <CopyProductOptionsDialog
        open={copyOptionsOpen}
        onOpenChange={setCopyOptionsOpen}
        products={products}
        currentProductId={editing?.id}
        currentGroups={form.option_groups || []}
        onApply={applyCopiedOptionGroups}
      />
    </AdminLayout>
  );
}
