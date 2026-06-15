import { useEffect, useState } from "react";
import AdminLayout from "@/components/AdminLayout";
import api, { formatApiErrorDetail } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

const empty = { name: "", description: "", icon: "" };

export default function Categories() {
  const [cats, setCats] = useState([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(empty);

  const load = async () => {
    const { data } = await api.get("/categories");
    setCats(data);
  };
  useEffect(() => { load(); }, []);

  const openNew = () => { setEditing(null); setForm(empty); setOpen(true); };
  const openEdit = (c) => { setEditing(c); setForm({ name: c.name, description: c.description || "", icon: c.icon || "" }); setOpen(true); };

  const save = async () => {
    if (!form.name.trim()) { toast.error("Informe o nome"); return; }
    try {
      if (editing) {
        await api.put(`/categories/${editing.id}`, form);
        toast.success("Categoria atualizada");
      } else {
        await api.post("/categories", form);
        toast.success("Categoria criada");
      }
      setOpen(false);
      await load();
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail) || "Erro");
    }
  };

  const remove = async (c) => {
    if (!window.confirm(`Excluir "${c.name}"?`)) return;
    try {
      await api.delete(`/categories/${c.id}`);
      toast.success("Categoria excluída");
      await load();
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail) || "Erro");
    }
  };

  return (
    <AdminLayout
      title="Categorias"
      actions={
        <Button data-testid="new-category-btn" className="bg-brand hover:bg-brand-dark rounded-xl" onClick={openNew}>
          <Plus className="h-4 w-4 mr-1.5" /> Nova
        </Button>
      }
    >
      <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden" data-testid="categories-list">
        {cats.length === 0 && <div className="p-8 text-center text-stone-500">Nenhuma categoria.</div>}
        {cats.map((c, idx) => (
          <div key={c.id} className={`flex items-center justify-between p-4 ${idx ? "border-t border-stone-100" : ""}`}>
            <div>
              <p className="font-medium text-stone-900">{c.name}</p>
              {c.description && <p className="text-sm text-stone-500">{c.description}</p>}
            </div>
            <div className="flex gap-1">
              <button onClick={() => openEdit(c)} data-testid={`edit-category-${c.id}`} className="h-8 w-8 grid place-items-center rounded-lg hover:bg-stone-100">
                <Pencil className="h-4 w-4" />
              </button>
              <button onClick={() => remove(c)} data-testid={`delete-category-${c.id}`} className="h-8 w-8 grid place-items-center rounded-lg hover:bg-red-50 text-red-600">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-serif text-2xl">{editing ? "Editar categoria" : "Nova categoria"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Nome</Label>
              <Input data-testid="form-category-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <Label>Descrição (opcional)</Label>
              <Textarea rows={2} data-testid="form-category-desc" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={save} data-testid="form-category-save" className="bg-brand hover:bg-brand-dark text-white">Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
