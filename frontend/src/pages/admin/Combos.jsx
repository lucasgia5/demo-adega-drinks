import { useEffect, useState } from "react";
import AdminLayout from "@/components/AdminLayout";
import api, { brl, formatApiErrorDetail } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Pencil, Plus, Trash2, UploadCloud } from "lucide-react";
import { toast } from "sonner";

const empty = {
  name: "",
  description: "",
  image_url: "",
  promotional_price: "",
  active: true,
  display_order: "0",
  products: [],
};

export default function Combos() {
  const [combos, setCombos] = useState([]);
  const [products, setProducts] = useState([]);
  const [form, setForm] = useState(empty);
  const [editing, setEditing] = useState(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [imagePreview, setImagePreview] = useState("");

  const load = async () => {
    const [{ data: comboData }, { data: productData }] = await Promise.all([
      api.get("/admin/combos"),
      api.get("/products"),
    ]);
    setCombos(comboData);
    setProducts(productData);
  };

  useEffect(() => {
    load();
  }, []);

  const openNew = () => {
    setEditing(null);
    setForm(empty);
    setImagePreview("");
    setOpen(true);
  };

  const openEdit = (combo) => {
    setEditing(combo);
    setForm({
      name: combo.name,
      description: combo.description || "",
      image_url: combo.image_url || "",
      promotional_price: String(combo.promotional_price),
      active: combo.active,
      display_order: String(combo.display_order || 0),
      products: combo.products || [],
    });
    setImagePreview(combo.image_url || "");
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
      const { data: upload } = await api.post("/admin/combos/upload-image", data, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setForm((current) => ({ ...current, image_url: upload.image_url }));
      setImagePreview(upload.image_url);
      toast.success("Imagem enviada");
    } catch (error) {
      setImagePreview(form.image_url);
      toast.error(formatApiErrorDetail(error.response?.data?.detail) || "Erro ao enviar imagem");
    } finally {
      URL.revokeObjectURL(previewUrl);
      setUploadingImage(false);
    }
  };

  const selectedQuantity = (productId) =>
    form.products.find((item) => item.product_id === productId)?.quantity || 0;

  const toggleProduct = (productId) => {
    setForm((current) => {
      const selected = current.products.some((item) => item.product_id === productId);
      return {
        ...current,
        products: selected
          ? current.products.filter((item) => item.product_id !== productId)
          : [...current.products, { product_id: productId, quantity: 1 }],
      };
    });
  };

  const setProductQuantity = (productId, quantity) => {
    const parsed = Math.max(1, Number(quantity) || 1);
    setForm((current) => ({
      ...current,
      products: current.products.map((item) =>
        item.product_id === productId ? { ...item, quantity: parsed } : item
      ),
    }));
  };

  const save = async () => {
    if (!form.name.trim() || form.promotional_price === "" || form.products.length === 0) {
      toast.error("Preencha nome, preço e selecione ao menos um produto");
      return;
    }

    setBusy(true);
    try {
      const payload = {
        name: form.name.trim(),
        description: form.description,
        image_url: form.image_url,
        products: form.products,
        promotional_price: Number(form.promotional_price),
        active: form.active,
        display_order: Number(form.display_order) || 0,
      };
      if (editing) {
        await api.put(`/admin/combos/${editing.id}`, payload);
        toast.success("Combo atualizado");
      } else {
        await api.post("/admin/combos", payload);
        toast.success("Combo criado");
      }
      setOpen(false);
      await load();
    } catch (error) {
      toast.error(formatApiErrorDetail(error.response?.data?.detail) || "Erro ao salvar combo");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (combo) => {
    if (!window.confirm(`Excluir "${combo.name}"?`)) return;
    try {
      await api.delete(`/admin/combos/${combo.id}`);
      toast.success("Combo excluído");
      await load();
    } catch (error) {
      toast.error(formatApiErrorDetail(error.response?.data?.detail) || "Erro ao excluir combo");
    }
  };

  return (
    <AdminLayout
      title="Combos"
      actions={
        <Button onClick={openNew} className="rounded-lg bg-brand hover:bg-brand-dark">
          <Plus className="mr-1.5 h-4 w-4" /> Novo
        </Button>
      }
    >
      <div className="overflow-hidden rounded-lg border border-stone-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-stone-50 text-xs uppercase tracking-wider text-stone-500">
            <tr>
              <th className="p-3 text-left">Combo</th>
              <th className="hidden p-3 text-left md:table-cell">Produtos</th>
              <th className="p-3 text-left">Preço</th>
              <th className="hidden p-3 text-left sm:table-cell">Status</th>
              <th className="p-3 text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {combos.length === 0 && (
              <tr>
                <td colSpan={5} className="p-10 text-center text-stone-500">
                  Nenhum combo cadastrado.
                </td>
              </tr>
            )}
            {combos.map((combo) => (
              <tr key={combo.id} className="border-t border-stone-100">
                <td className="p-3">
                  <p className="font-medium text-stone-900">{combo.name}</p>
                  <p className="text-xs text-stone-500">Ordem {combo.display_order}</p>
                </td>
                <td className="hidden p-3 text-stone-600 md:table-cell">
                  {combo.resolved_products
                    ?.map((item) => `${item.quantity}x ${item.name}`)
                    .join(", ")}
                </td>
                <td className="p-3 font-semibold text-brand">
                  {brl(combo.promotional_price)}
                </td>
                <td className="hidden p-3 sm:table-cell">
                  <span className={`rounded-full px-2 py-0.5 text-xs ${
                    combo.active && combo.purchasable
                      ? "bg-green-100 text-green-800"
                      : "bg-stone-100 text-stone-600"
                  }`}>
                    {combo.active && combo.purchasable ? "Ativo" : "Indisponível"}
                  </span>
                </td>
                <td className="p-3 text-right">
                  <button
                    onClick={() => openEdit(combo)}
                    className="inline-grid h-8 w-8 place-items-center rounded-lg hover:bg-stone-100"
                    aria-label={`Editar ${combo.name}`}
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => remove(combo)}
                    className="inline-grid h-8 w-8 place-items-center rounded-lg text-red-600 hover:bg-red-50"
                    aria-label={`Excluir ${combo.name}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="font-serif text-2xl">
              {editing ? "Editar combo" : "Novo combo"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>Nome</Label>
              <Input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
            </div>
            <div>
              <Label>Descrição</Label>
              <Textarea rows={3} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
            </div>
            <div className="space-y-3 rounded-xl border border-stone-200 p-3">
              <div>
                <Label>URL da imagem (opcional)</Label>
                <Input
                  data-testid="form-combo-image"
                  placeholder="https://..."
                  value={form.image_url}
                  onChange={(event) => {
                    setForm({ ...form, image_url: event.target.value });
                    setImagePreview(event.target.value);
                  }}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="combo-image-upload">Upload de imagem</Label>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <Input
                    id="combo-image-upload"
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    data-testid="form-combo-image-upload"
                    onChange={(event) => uploadImage(event.target.files?.[0])}
                    disabled={uploadingImage}
                  />
                  <span className="inline-flex items-center gap-1 text-xs text-stone-500">
                    <UploadCloud className="h-3.5 w-3.5" />
                    JPG, PNG ou WEBP até 5MB
                  </span>
                </div>
                {uploadingImage && <p className="text-xs text-stone-500">Enviando imagem...</p>}
              </div>
              {imagePreview && (
                <div className="overflow-hidden rounded-xl border border-stone-200 bg-stone-50">
                  <img
                    src={imagePreview}
                    alt="Prévia do combo"
                    className="h-40 w-full object-cover"
                  />
                </div>
              )}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label>Preço promocional</Label>
                <Input type="number" min="0" step="0.01" value={form.promotional_price} onChange={(event) => setForm({ ...form, promotional_price: event.target.value })} />
              </div>
              <div>
                <Label>Ordem de exibição</Label>
                <Input type="number" min="0" step="1" value={form.display_order} onChange={(event) => setForm({ ...form, display_order: event.target.value })} />
              </div>
            </div>

            <div className="flex items-center justify-between rounded-lg border border-stone-200 p-3">
              <div>
                <p className="text-sm font-medium">Combo ativo</p>
                <p className="text-xs text-stone-500">Exibe na home quando todos os produtos estão disponíveis.</p>
              </div>
              <Switch checked={form.active} onCheckedChange={(active) => setForm({ ...form, active })} />
            </div>

            <div>
              <Label>Produtos do combo</Label>
              <div className="mt-2 max-h-64 space-y-2 overflow-y-auto rounded-lg border border-stone-200 p-2">
                {products.map((product) => {
                  const quantity = selectedQuantity(product.id);
                  return (
                    <div key={product.id} className="flex items-center gap-3 rounded-md p-2 hover:bg-stone-50">
                      <input
                        type="checkbox"
                        checked={quantity > 0}
                        onChange={() => toggleProduct(product.id)}
                        className="h-4 w-4 accent-brand"
                      />
                      <span className="min-w-0 flex-1 truncate text-sm">
                        {product.name}
                        {!product.available && (
                          <span className="ml-2 text-xs text-red-600">Indisponível</span>
                        )}
                      </span>
                      {quantity > 0 && (
                        <Input
                          type="number"
                          min="1"
                          step="1"
                          value={quantity}
                          onChange={(event) => setProductQuantity(product.id, event.target.value)}
                          className="h-9 w-20"
                          aria-label={`Quantidade de ${product.name}`}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button disabled={busy} onClick={save} className="bg-brand text-white hover:bg-brand-dark">
              {busy ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
