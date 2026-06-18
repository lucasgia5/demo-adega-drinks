import { useEffect, useState } from "react";
import AdminLayout from "@/components/AdminLayout";
import api, { formatApiErrorDetail } from "@/lib/api";
import { useStoreConfig } from "@/context/StoreConfigContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { ImageUp, Save } from "lucide-react";
import { toast } from "sonner";

const empty = {
  store_name: "",
  store_logo_url: "",
  store_banner_url: "",
  banner_title: "",
  banner_subtitle: "",
  banner_button_text: "",
  banner_button_link: "",
  banner_enabled: true,
};

export default function StoreSettings() {
  const { refreshConfig } = useStoreConfig();
  const [form, setForm] = useState(empty);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get("/admin/store-settings");
        setForm({
          store_name: data.store_name || data.name || "",
          store_logo_url: data.store_logo_url || data.logo_url || "",
          store_banner_url: data.store_banner_url || data.banner_url || "",
          banner_title: data.banner_title || "",
          banner_subtitle: data.banner_subtitle || "",
          banner_button_text: data.banner_button_text || "",
          banner_button_link: data.banner_button_link || "",
          banner_enabled: data.banner_enabled !== false,
        });
      } catch (error) {
        toast.error(formatApiErrorDetail(error.response?.data?.detail) || "Erro ao carregar identidade");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const uploadImage = async (imageType, file) => {
    if (!file) return;
    setUploading(imageType);
    try {
      const payload = new FormData();
      payload.append("file", file);
      const { data } = await api.post(
        `/admin/store-settings/upload-image?image_type=${imageType}`,
        payload,
        { headers: { "Content-Type": "multipart/form-data" } }
      );
      const field = imageType === "logo" ? "store_logo_url" : "store_banner_url";
      setForm((current) => ({ ...current, [field]: data.image_url }));
      toast.success(imageType === "logo" ? "Logo enviado" : "Banner enviado");
    } catch (error) {
      toast.error(formatApiErrorDetail(error.response?.data?.detail) || "Erro ao enviar imagem");
    } finally {
      setUploading("");
    }
  };

  const save = async () => {
    if (!form.store_name.trim()) {
      toast.error("Informe o nome da loja");
      return;
    }
    setSaving(true);
    try {
      await api.put("/admin/store-settings", form);
      await refreshConfig();
      toast.success("Identidade da loja atualizada");
    } catch (error) {
      toast.error(formatApiErrorDetail(error.response?.data?.detail) || "Erro ao salvar identidade");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <AdminLayout title="Identidade da Loja">
        <p className="text-stone-500">Carregando...</p>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout
      title="Identidade da Loja"
      actions={
        <Button onClick={save} disabled={saving} className="rounded-lg bg-brand hover:bg-brand-dark">
          <Save className="mr-1.5 h-4 w-4" />
          {saving ? "Salvando..." : "Salvar"}
        </Button>
      }
    >
      <div className="max-w-4xl space-y-6">
        <section className="border-b border-stone-200 bg-white p-5 sm:p-6">
          <h2 className="font-serif text-xl font-semibold text-stone-900">Loja</h2>
          <div className="mt-4">
            <Label htmlFor="store-name">Nome da loja</Label>
            <Input
              id="store-name"
              value={form.store_name}
              onChange={(event) => setForm({ ...form, store_name: event.target.value })}
            />
          </div>
        </section>

        <section className="border-b border-stone-200 bg-white p-5 sm:p-6">
          <h2 className="font-serif text-xl font-semibold text-stone-900">Logo / foto de perfil</h2>
          <div className="mt-4 grid gap-5 sm:grid-cols-[180px_1fr]">
            <div className="grid h-40 place-items-center overflow-hidden rounded-lg border border-stone-200 bg-stone-50">
              {form.store_logo_url ? (
                <img src={form.store_logo_url} alt="Logo atual da loja" className="max-h-full max-w-full object-contain p-4" />
              ) : (
                <span className="text-sm text-stone-400">Sem logo configurado</span>
              )}
            </div>
            <div className="space-y-3">
              <div>
                <Label>URL do logo</Label>
                <Input
                  placeholder="https://..."
                  value={form.store_logo_url}
                  onChange={(event) => setForm({ ...form, store_logo_url: event.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="logo-upload">Enviar novo logo</Label>
                <label
                  htmlFor="logo-upload"
                  className="mt-1 flex h-11 cursor-pointer items-center justify-center gap-2 rounded-md border border-stone-300 bg-white text-sm font-medium hover:bg-stone-50"
                >
                  <ImageUp className="h-4 w-4" />
                  {uploading === "logo" ? "Enviando..." : "Selecionar imagem"}
                </label>
                <input
                  id="logo-upload"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="sr-only"
                  disabled={!!uploading}
                  onChange={(event) => uploadImage("logo", event.target.files?.[0])}
                />
              </div>
            </div>
          </div>
        </section>

        <section className="bg-white p-5 sm:p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="font-serif text-xl font-semibold text-stone-900">Banner principal</h2>
              <p className="text-sm text-stone-500">Imagem e conteúdo exibidos no topo da home.</p>
            </div>
            <Switch
              checked={form.banner_enabled}
              onCheckedChange={(banner_enabled) => setForm({ ...form, banner_enabled })}
            />
          </div>

          <div className="mt-4 overflow-hidden rounded-lg border border-stone-200 bg-stone-100">
            <div className="relative aspect-[16/6] min-h-44">
              {form.store_banner_url ? (
                <img src={form.store_banner_url} alt="Banner atual" className="absolute inset-0 h-full w-full object-cover" />
              ) : (
                <div className="absolute inset-0 bg-brand" />
              )}
              <div className="absolute inset-0 bg-black/45" />
              <div className="relative flex h-full flex-col justify-end p-5 text-white">
                <h3 className="font-serif text-2xl font-semibold">
                  {form.banner_title || form.store_name}
                </h3>
                {form.banner_subtitle && <p className="mt-1 text-sm text-white/85">{form.banner_subtitle}</p>}
              </div>
            </div>
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label>URL do banner</Label>
              <Input
                placeholder="https://..."
                value={form.store_banner_url}
                onChange={(event) => setForm({ ...form, store_banner_url: event.target.value })}
              />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="banner-upload">Enviar novo banner</Label>
              <label
                htmlFor="banner-upload"
                className="mt-1 flex h-11 cursor-pointer items-center justify-center gap-2 rounded-md border border-stone-300 bg-white text-sm font-medium hover:bg-stone-50"
              >
                <ImageUp className="h-4 w-4" />
                {uploading === "banner" ? "Enviando..." : "Selecionar imagem"}
              </label>
              <input
                id="banner-upload"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="sr-only"
                disabled={!!uploading}
                onChange={(event) => uploadImage("banner", event.target.files?.[0])}
              />
            </div>
            <div>
              <Label>Título do banner</Label>
              <Input value={form.banner_title} onChange={(event) => setForm({ ...form, banner_title: event.target.value })} />
            </div>
            <div>
              <Label>Texto do botão</Label>
              <Input value={form.banner_button_text} onChange={(event) => setForm({ ...form, banner_button_text: event.target.value })} />
            </div>
            <div className="sm:col-span-2">
              <Label>Subtítulo do banner</Label>
              <Textarea rows={2} value={form.banner_subtitle} onChange={(event) => setForm({ ...form, banner_subtitle: event.target.value })} />
            </div>
            <div className="sm:col-span-2">
              <Label>Link do botão</Label>
              <Input
                placeholder="/produtos ou https://..."
                value={form.banner_button_link}
                onChange={(event) => setForm({ ...form, banner_button_link: event.target.value })}
              />
            </div>
          </div>
        </section>
      </div>
    </AdminLayout>
  );
}
