import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useCart } from "@/context/CartContext";
import { useAuth } from "@/context/AuthContext";
import { useStoreConfig } from "@/context/StoreConfigContext";
import api, { brl, formatApiErrorDetail } from "@/lib/api";
import Header from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { ArrowLeft, Copy } from "lucide-react";

const PAYMENT_LABELS = {
  pix: "Pix para a adega",
  dinheiro: "Dinheiro na entrega",
  cartao: "Cartão na entrega",
};

export default function Checkout() {
  const { items, total: subtotal, clear } = useCart();
  const { user } = useAuth();
  const { config } = useStoreConfig();
  const navigate = useNavigate();

  const [areas, setAreas] = useState([]);
  const [form, setForm] = useState({
    name: user?.name || "",
    phone: user?.phone || "",
    address: "",
    delivery_area_id: "",
    payment: "pix",
    observations: "",
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get("/delivery-areas");
        setAreas(data);
      } catch {
        setAreas([]);
      }
    })();
  }, []);

  const onChange = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const selectedArea = useMemo(
    () => areas.find((a) => a.id === form.delivery_area_id) || null,
    [areas, form.delivery_area_id]
  );
  const deliveryFee = selectedArea ? Number(selectedArea.fee || 0) : 0;
  const total = subtotal + deliveryFee;
  const belowMin =
    selectedArea && selectedArea.min_order != null && subtotal < Number(selectedArea.min_order);

  const formatWhatsAppMessage = (order) => {
    const lines = [];
    lines.push(`*Novo Pedido — ${config?.name || "Adega"}*`);
    lines.push("");
    lines.push(`*Cliente:* ${order.customer_name}`);
    lines.push(`*Telefone:* ${order.customer_phone}`);
    if (order.delivery_area_name) {
      lines.push(`*Bairro/Região:* ${order.delivery_area_name}`);
    }
    lines.push(`*Endereço:* ${order.customer_address}`);
    lines.push("");
    lines.push(`*Itens:*`);
    order.items.forEach((i) => {
      lines.push(`• ${i.quantity}x ${i.name} — ${brl(i.unit_price * i.quantity)}`);
    });
    lines.push("");
    lines.push(`*Subtotal:* ${brl(order.subtotal ?? subtotal)}`);
    lines.push(`*Taxa de entrega:* ${brl(order.delivery_fee ?? 0)}`);
    lines.push(`*Total:* ${brl(order.total)}`);
    lines.push(`*Pagamento:* ${PAYMENT_LABELS[order.payment_method] || order.payment_method}`);
    if (order.payment_method === "pix" && config?.pix_key) {
      lines.push(`*Chave Pix (${config.pix_key_type || "Pix"}):* ${config.pix_key}`);
    }
    if (order.observations) {
      lines.push("");
      lines.push(`*Observações:* ${order.observations}`);
    }
    lines.push("");
    lines.push(`Pedido #${order.id.slice(0, 8).toUpperCase()}`);
    return lines.join("\n");
  };

  const placeOrder = async (e) => {
    e.preventDefault();
    if (items.length === 0) {
      toast.error("Seu carrinho está vazio");
      return;
    }
    if (!form.name.trim() || !form.phone.trim() || !form.address.trim()) {
      toast.error("Preencha nome, telefone e endereço");
      return;
    }
    if (areas.length > 0 && !form.delivery_area_id) {
      toast.error("Selecione o bairro/região de entrega");
      return;
    }
    if (belowMin) {
      toast.error(`Pedido mínimo para ${selectedArea.name} é ${brl(selectedArea.min_order)}`);
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        customer_name: form.name,
        customer_phone: form.phone,
        customer_address: form.address,
        payment_method: form.payment,
        delivery_area_id: form.delivery_area_id || null,
        items: items.map((i) => ({
          product_id: i.product_id,
          name: i.name,
          quantity: i.quantity,
          unit_price: i.unit_price,
        })),
        observations: form.observations,
      };
      const { data: order } = await api.post("/orders", payload);

      const msg = formatWhatsAppMessage(order);
      const whatsappNumber = (config?.whatsapp_number || "").replace(/\D/g, "");
      const url = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(msg)}`;

      clear();
      toast.success("Pedido enviado! Abrindo WhatsApp...");
      window.open(url, "_blank");
      setTimeout(() => navigate("/"), 800);
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail) || "Erro ao enviar pedido");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-brand-cream">
      <Header />
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-24">
        <button
          onClick={() => navigate(-1)}
          className="inline-flex items-center text-sm text-stone-600 hover:text-brand mb-4"
          data-testid="back-checkout"
        >
          <ArrowLeft className="h-4 w-4 mr-1.5" /> Continuar comprando
        </button>

        <h1 className="font-serif text-3xl sm:text-4xl font-semibold text-stone-900">Finalizar pedido</h1>
        <p className="text-stone-500 mt-1">Preencha seus dados — você não precisa criar conta.</p>

        <form onSubmit={placeOrder} className="grid lg:grid-cols-3 gap-6 mt-8">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-2xl border border-stone-200 p-6">
              <h2 className="font-serif text-xl font-semibold mb-4">Dados de contato</h2>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="name">Nome completo</Label>
                  <Input
                    id="name" data-testid="checkout-name"
                    value={form.name} onChange={(e) => onChange("name", e.target.value)} required
                  />
                </div>
                <div>
                  <Label htmlFor="phone">Telefone (com DDD)</Label>
                  <Input
                    id="phone" data-testid="checkout-phone"
                    placeholder="(11) 99999-9999"
                    value={form.phone} onChange={(e) => onChange("phone", e.target.value)} required
                  />
                </div>
                <div className="sm:col-span-2">
                  <Label htmlFor="address">Endereço completo</Label>
                  <Input
                    id="address" data-testid="checkout-address"
                    placeholder="Rua, número, bairro, complemento"
                    value={form.address} onChange={(e) => onChange("address", e.target.value)} required
                  />
                </div>
                <div className="sm:col-span-2">
                  <Label>Bairro / Região de entrega</Label>
                  {areas.length === 0 ? (
                    <p className="text-sm text-stone-500 mt-1">
                      Nenhuma região cadastrada. A entrega seguirá sem taxa.
                    </p>
                  ) : (
                    <Select
                      value={form.delivery_area_id}
                      onValueChange={(v) => onChange("delivery_area_id", v)}
                    >
                      <SelectTrigger data-testid="checkout-area">
                        <SelectValue placeholder="Selecione seu bairro/região" />
                      </SelectTrigger>
                      <SelectContent>
                        {areas.map((a) => (
                          <SelectItem key={a.id} value={a.id}>
                            {a.name} — Taxa {brl(a.fee)}
                            {a.min_order != null ? ` · mín. ${brl(a.min_order)}` : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  {belowMin && (
                    <p className="text-xs text-red-600 mt-2" data-testid="min-order-warning">
                      Pedido mínimo para {selectedArea?.name}: {brl(selectedArea?.min_order)}. Adicione mais itens.
                    </p>
                  )}
                </div>
                <div className="sm:col-span-2">
                  <Label htmlFor="obs">Observações (opcional)</Label>
                  <Textarea
                    id="obs" data-testid="checkout-obs"
                    rows={3}
                    value={form.observations} onChange={(e) => onChange("observations", e.target.value)}
                  />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-stone-200 p-6">
              <h2 className="font-serif text-xl font-semibold mb-4">Forma de pagamento</h2>
              <RadioGroup
                value={form.payment}
                onValueChange={(v) => onChange("payment", v)}
                className="space-y-2"
              >
                {Object.entries(PAYMENT_LABELS).map(([value, label]) => (
                  <label
                    key={value}
                    htmlFor={`pay-${value}`}
                    className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                      form.payment === value ? "border-brand bg-brand/5" : "border-stone-200 hover:border-stone-300"
                    }`}
                    data-testid={`payment-${value}`}
                  >
                    <RadioGroupItem value={value} id={`pay-${value}`} />
                    <span className="font-medium">{label}</span>
                  </label>
                ))}
              </RadioGroup>

              {form.payment === "pix" && config?.pix_key && (
                <div className="mt-4 bg-brand/5 border border-brand/10 rounded-xl p-4">
                  <p className="text-xs uppercase tracking-wider text-stone-500">Chave Pix ({config.pix_key_type})</p>
                  <div className="flex items-center justify-between gap-3 mt-1">
                    <code className="text-sm font-medium text-stone-900 break-all" data-testid="pix-key">
                      {config.pix_key}
                    </code>
                    <button
                      type="button"
                      onClick={() => { navigator.clipboard.writeText(config.pix_key); toast.success("Chave copiada"); }}
                      className="shrink-0 inline-flex items-center gap-1.5 text-xs px-2 py-1.5 rounded-md bg-white border border-stone-200 hover:border-brand/40"
                      data-testid="copy-pix"
                    >
                      <Copy className="h-3 w-3" /> Copiar
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          <aside className="lg:col-span-1">
            <div className="bg-white rounded-2xl border border-stone-200 p-6 sticky top-20">
              <h2 className="font-serif text-xl font-semibold mb-4">Resumo</h2>
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1" data-testid="checkout-items">
                {items.length === 0 && (
                  <p className="text-sm text-stone-500">Seu carrinho está vazio.</p>
                )}
                {items.map((i) => (
                  <div key={i.product_id} className="flex justify-between text-sm">
                    <span className="text-stone-700">{i.quantity}× {i.name}</span>
                    <span className="font-medium">{brl(i.unit_price * i.quantity)}</span>
                  </div>
                ))}
              </div>
              <div className="border-t border-stone-100 mt-4 pt-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-stone-600">Subtotal</span>
                  <span className="font-medium" data-testid="checkout-subtotal">{brl(subtotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-600">Taxa de entrega {selectedArea ? `(${selectedArea.name})` : ""}</span>
                  <span className="font-medium" data-testid="checkout-delivery-fee">
                    {selectedArea ? brl(deliveryFee) : "—"}
                  </span>
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-stone-100">
                  <span className="text-stone-600">Total</span>
                  <span className="font-serif text-2xl font-semibold text-brand" data-testid="checkout-total">
                    {brl(total)}
                  </span>
                </div>
              </div>
              <Button
                type="submit"
                disabled={submitting || items.length === 0 || belowMin}
                data-testid="confirm-order-btn"
                className="w-full mt-4 h-12 rounded-xl bg-brand hover:bg-brand-dark text-white font-medium"
              >
                {submitting ? "Enviando..." : "Confirmar e enviar via WhatsApp"}
              </Button>
              <p className="text-xs text-stone-500 mt-3 text-center">
                Seu pedido será aberto no WhatsApp da adega já preenchido.
              </p>
            </div>
          </aside>
        </form>
      </div>
    </div>
  );
}
