import { useEffect, useState } from "react";
import AdminLayout from "@/components/AdminLayout";
import api, { brl, formatApiErrorDetail } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

const empty = { name: "", fee: "", min_order: "", active: true };

export default function DeliveryAreas() {
  const [areas, setAreas] = useState([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(empty);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const { data } = await api.get("/admin/delivery-areas");
    setAreas(data);
  };
  useEffect(() => { load(); }, []);

  const openNew = () => { setEditing(null); setForm(empty); setOpen(true); };
  const openEdit = (a) => {
    setEditing(a);
    setForm({
      name: a.name,
      fee: String(a.fee ?? ""),
      min_order: a.min_order != null ? String(a.min_order) : "",
      active: !!a.active,
    });
    setOpen(true);
  };

  const save = async () => {
    if (!form.name.trim() || form.fee === "") {
      toast.error("Informe nome e taxa de entrega");
      return;
    }
    setBusy(true);
    try {
      const payload = {
        name: form.name.trim(),
        fee: Number(form.fee),
        min_order: form.min_order !== "" ? Number(form.min_order) : null,
        active: form.active,
      };
      if (editing) {
        await api.put(`/admin/delivery-areas/${editing.id}`, payload);
        toast.success("Área atualizada");
      } else {
        await api.post("/admin/delivery-areas", payload);
        toast.success("Área criada");
      }
      setOpen(false);
      await load();
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail) || "Erro");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (a) => {
    if (!window.confirm(`Excluir "${a.name}"?`)) return;
    try {
      await api.delete(`/admin/delivery-areas/${a.id}`);
      toast.success("Área excluída");
      await load();
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail) || "Erro");
    }
  };

  const toggleActive = async (a) => {
    try {
      await api.put(`/admin/delivery-areas/${a.id}`, {
        name: a.name, fee: a.fee, min_order: a.min_order, active: !a.active,
      });
      await load();
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail) || "Erro");
    }
  };

  return (
    <AdminLayout
      title="Áreas de entrega"
      actions={
        <Button data-testid="new-area-btn" className="bg-brand hover:bg-brand-dark rounded-xl" onClick={openNew}>
          <Plus className="h-4 w-4 mr-1.5" /> Nova área
        </Button>
      }
    >
      <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-stone-50 text-stone-500 uppercase tracking-wider text-xs">
            <tr>
              <th className="text-left p-3">Bairro / Região</th>
              <th className="text-left p-3">Taxa</th>
              <th className="text-left p-3 hidden md:table-cell">Pedido mínimo</th>
              <th className="text-left p-3">Ativa</th>
              <th className="text-right p-3">Ações</th>
            </tr>
          </thead>
          <tbody data-testid="areas-table">
            {areas.length === 0 && (
              <tr><td colSpan={5} className="p-8 text-center text-stone-500">Nenhuma área cadastrada.</td></tr>
            )}
            {areas.map((a) => (
              <tr key={a.id} className="border-t border-stone-100" data-testid={`area-row-${a.id}`}>
                <td className="p-3 font-medium text-stone-900">{a.name}</td>
                <td className="p-3 font-medium">{brl(a.fee)}</td>
                <td className="p-3 hidden md:table-cell text-stone-700">
                  {a.min_order != null ? brl(a.min_order) : "—"}
                </td>
                <td className="p-3">
                  <Switch
                    checked={a.active}
                    onCheckedChange={() => toggleActive(a)}
                    data-testid={`toggle-area-${a.id}`}
                  />
                </td>
                <td className="p-3 text-right">
                  <button onClick={() => openEdit(a)} data-testid={`edit-area-${a.id}`} className="inline-flex h-8 w-8 items-center justify-center rounded-lg hover:bg-stone-100">
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button onClick={() => remove(a)} data-testid={`delete-area-${a.id}`} className="inline-flex h-8 w-8 items-center justify-center rounded-lg hover:bg-red-50 text-red-600">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-serif text-2xl">{editing ? "Editar área" : "Nova área de entrega"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Bairro / Região</Label>
              <Input data-testid="form-area-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex: Centro" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Taxa de entrega (R$)</Label>
                <Input type="number" step="0.01" data-testid="form-area-fee" value={form.fee} onChange={(e) => setForm({ ...form, fee: e.target.value })} />
              </div>
              <div>
                <Label>Pedido mínimo (R$)</Label>
                <Input type="number" step="0.01" data-testid="form-area-min" placeholder="Opcional" value={form.min_order} onChange={(e) => setForm({ ...form, min_order: e.target.value })} />
              </div>
            </div>
            <div className="flex items-center justify-between rounded-xl border border-stone-200 p-3">
              <div>
                <p className="text-sm font-medium">Região ativa</p>
                <p className="text-xs text-stone-500">Quando inativa, não aparece no checkout.</p>
              </div>
              <Switch checked={form.active} onCheckedChange={(v) => setForm({ ...form, active: v })} data-testid="form-area-active" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button disabled={busy} onClick={save} data-testid="form-area-save" className="bg-brand hover:bg-brand-dark text-white">
              {busy ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
