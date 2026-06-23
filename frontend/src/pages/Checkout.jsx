import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useCart } from "@/context/CartContext";
import { useAuth } from "@/context/AuthContext";
import { useStoreConfig } from "@/context/StoreConfigContext";
import { STORE_CONFIG_FALLBACK } from "@/whiteLabelDefaults";
import { calculateBusinessStatus, useBusinessStatus } from "@/hooks/useBusinessStatus";
import api, { brl, formatApiErrorDetail } from "@/lib/api";
import Header from "@/components/Header";
import FreeShippingProgress from "@/components/FreeShippingProgress";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  AlertTriangle, ArrowLeft, CheckCircle2, Copy, ExternalLink, MapPin, Store,
} from "lucide-react";

const PAYMENT_LABELS = {
  pix: "Pix",
  dinheiro: "Dinheiro",
  cartao: "Cartão",
};

const FULFILLMENT_LABELS = {
  delivery: "Entrega",
  pickup: "Retirada no local",
};

const isMobileDevice = () => {
  if (navigator.userAgentData?.mobile === true) return true;
  if (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1) return true;
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
};

const buildWhatsAppUrl = (number, message) => {
  const digits = String(number || "").replace(/\D/g, "");
  if (!/^\d{10,15}$/.test(digits)) return "";
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
};

export default function Checkout() {
  const { items, total: subtotal, clear } = useCart();
  const { user } = useAuth();
  const { config } = useStoreConfig();
  const businessStatus = useBusinessStatus(config);
  const navigate = useNavigate();

  const [areas, setAreas] = useState([]);
  const [form, setForm] = useState({
    name: user?.name || "",
    phone: user?.phone || "",
    address: "",
    fulfillment_type: "delivery",
    delivery_area_id: "",
    payment: "pix",
    observations: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [completedOrder, setCompletedOrder] = useState(null);

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
  const isPickup = form.fulfillment_type === "pickup";
  const freeShippingMinimum = Number(config?.free_shipping_minimum);
  const freeShippingReached =
    !isPickup &&
    config?.free_shipping_enabled === true &&
    Number.isFinite(freeShippingMinimum) &&
    freeShippingMinimum >= 0 &&
    subtotal >= freeShippingMinimum;
  const deliveryFee =
    !isPickup && selectedArea && !freeShippingReached ? Number(selectedArea.fee || 0) : 0;
  const total = subtotal + deliveryFee;
  const belowMin =
    !isPickup &&
    selectedArea &&
    selectedArea.min_order != null &&
    subtotal < Number(selectedArea.min_order);

  const formatWhatsAppMessage = (order) => {
    const lines = [];
    const orderBusinessStatus = calculateBusinessStatus(config, new Date());
    lines.push(`*Novo Pedido - ${config?.name || STORE_CONFIG_FALLBACK.name}*`);
    lines.push(`*Tipo:* ${FULFILLMENT_LABELS[order.fulfillment_type || "delivery"]}`);
    if (orderBusinessStatus) {
      lines.push(
        `*Status da loja no momento do pedido:* ${
          orderBusinessStatus.isOpen ? "Aberta" : "Fechada"
        }`
      );
    }
    lines.push("");
    lines.push(`*Cliente:* ${order.customer_name}`);
    lines.push(`*Telefone:* ${order.customer_phone}`);
    if ((order.fulfillment_type || "delivery") === "delivery" && order.delivery_area_name) {
      lines.push(`*Bairro/Região:* ${order.delivery_area_name}`);
    }
    lines.push(`*Endereço:* ${order.customer_address}`);
    lines.push("");
    lines.push(`*Itens:*`);
    order.items.forEach((i) => {
      if (i.item_type === "combo") {
        lines.push(`• ${i.quantity}x *COMBO* ${i.name} — ${brl(i.unit_price * i.quantity)}`);
        i.combo_items?.forEach((comboItem) => {
          lines.push(`  - ${comboItem.quantity}x ${comboItem.name} por combo`);
        });
      } else {
        lines.push(`• ${i.quantity}x ${i.name} — ${brl(i.unit_price * i.quantity)}`);
      }
    });
    lines.push("");
    lines.push(`*Subtotal:* ${brl(order.subtotal ?? subtotal)}`);
    if ((order.fulfillment_type || "delivery") === "delivery") {
      lines.push(`*Taxa de entrega:* ${brl(order.delivery_fee ?? 0)}`);
      if (order.free_shipping_applied) {
        lines.push("*Frete grátis aplicado*");
      }
    }
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

  const openWhatsApp = (whatsappUrl) => {
    if (!whatsappUrl) {
      toast.error("O WhatsApp da loja não está configurado corretamente");
      return false;
    }

    try {
      if (isMobileDevice()) {
        window.location.href = whatsappUrl;
        return true;
      }

      const opened = window.open(whatsappUrl, "_blank", "noopener,noreferrer");
      if (!opened) {
        toast.info("Use o botão “Abrir WhatsApp” para continuar");
        return false;
      }
      return true;
    } catch {
      toast.info("Use o botão “Abrir WhatsApp” para continuar");
      return false;
    }
  };

  const copyWhatsAppMessage = async () => {
    if (!completedOrder?.message) return;

    try {
      await navigator.clipboard.writeText(completedOrder.message);
      toast.success("Mensagem copiada");
    } catch {
      try {
        const textarea = document.createElement("textarea");
        textarea.value = completedOrder.message;
        textarea.setAttribute("readonly", "");
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.select();
        const copied = document.execCommand("copy");
        document.body.removeChild(textarea);
        copied
          ? toast.success("Mensagem copiada")
          : toast.error("Não foi possível copiar a mensagem");
      } catch {
        toast.error("Não foi possível copiar a mensagem");
      }
    }
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
    if (!isPickup && areas.length > 0 && !form.delivery_area_id) {
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
        fulfillment_type: form.fulfillment_type,
        delivery_area_id: isPickup ? null : form.delivery_area_id || null,
        items: items.map((i) =>
          i.item_type === "combo"
            ? {
                item_type: "combo",
                combo_id: i.combo_id,
                quantity: i.quantity,
              }
            : {
                item_type: "product",
                product_id: i.product_id,
                quantity: i.quantity,
              }
        ),
        observations: form.observations,
      };
      const { data: order } = await api.post("/orders", payload);

      const message = formatWhatsAppMessage(order);
      const whatsappUrl = buildWhatsAppUrl(config?.whatsapp_number, message);

      setCompletedOrder({ order, message, whatsappUrl });
      clear();
      toast.success("Pedido salvo com sucesso");
      openWhatsApp(whatsappUrl);
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
        {completedOrder ? (
          <div
            className="mx-auto mt-8 max-w-xl rounded-2xl border border-emerald-200 bg-white p-6 text-center shadow-sm sm:p-8"
            role="status"
            data-testid="order-success"
          >
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
              <CheckCircle2 className="h-7 w-7" />
            </div>
            <h1 className="mt-4 font-serif text-3xl font-semibold text-stone-900">
              Pedido salvo com sucesso
            </h1>
            <p className="mt-2 text-stone-600">
              Pedido #{completedOrder.order.id.slice(0, 8).toUpperCase()} registrado. Agora envie
              a mensagem para a loja pelo WhatsApp.
            </p>
            {!completedOrder.whatsappUrl && (
              <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                O número do WhatsApp da loja não está configurado corretamente. Seu pedido continua
                salvo e pode ser consultado no painel administrativo.
              </div>
            )}
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <Button
                type="button"
                disabled={!completedOrder.whatsappUrl}
                onClick={() => openWhatsApp(completedOrder.whatsappUrl)}
                className="h-12 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700"
                data-testid="open-whatsapp"
              >
                <ExternalLink className="h-4 w-4" /> Abrir WhatsApp
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={copyWhatsAppMessage}
                className="h-12 rounded-xl"
                data-testid="copy-whatsapp-message"
              >
                <Copy className="h-4 w-4" /> Copiar mensagem
              </Button>
            </div>
            <Button
              type="button"
              variant="link"
              onClick={() => navigate("/")}
              className="mt-4 text-brand"
            >
              Voltar para a loja
            </Button>
          </div>
        ) : (
          <>
        <button
          onClick={() => navigate("/")}
          className="inline-flex items-center text-sm text-stone-600 hover:text-brand mb-4"
          data-testid="back-checkout"
        >
          <ArrowLeft className="h-4 w-4 mr-1.5" /> Continuar comprando
        </button>

        <h1 className="font-serif text-3xl sm:text-4xl font-semibold text-stone-900">Finalizar pedido</h1>
        <p className="text-stone-500 mt-1">Preencha seus dados — você não precisa criar conta.</p>

        <form onSubmit={placeOrder} className="grid lg:grid-cols-3 gap-6 mt-8">
          <div className="lg:col-span-2 space-y-6">
            {businessStatus && !businessStatus.isOpen && (
              <div
                className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-900"
                role="status"
                data-testid="business-closed-warning"
              >
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
                <div>
                  <p className="font-medium">A loja está fechada agora.</p>
                  <p className="mt-1 text-sm text-amber-800">
                    Seu pedido poderá ser respondido no próximo horário de funcionamento.
                    {businessStatus.timingLabel ? ` ${businessStatus.timingLabel}.` : ""}
                  </p>
                </div>
              </div>
            )}
            <div className="bg-white rounded-2xl border border-stone-200 p-6">
              <h2 className="font-serif text-xl font-semibold mb-4">Como você quer receber?</h2>
              <RadioGroup
                value={form.fulfillment_type}
                onValueChange={(value) => onChange("fulfillment_type", value)}
                className="grid sm:grid-cols-2 gap-3"
              >
                <FulfillmentOption
                  value="delivery"
                  label="Entrega"
                  description="Receba no endereço informado"
                  icon={MapPin}
                  active={!isPickup}
                />
                <FulfillmentOption
                  value="pickup"
                  label="Retirada no local"
                  description="Busque seu pedido diretamente na loja"
                  icon={Store}
                  active={isPickup}
                />
              </RadioGroup>
            </div>

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
                {!isPickup && (
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
                )}
                {isPickup && (
                  <div className="sm:col-span-2 rounded-xl border border-brand/10 bg-brand/5 p-4">
                    <p className="text-sm font-medium text-stone-900">Retirada no local selecionada</p>
                    <p className="mt-1 text-sm text-stone-600">
                      Não há taxa de entrega nem pedido mínimo por região.
                    </p>
                  </div>
                )}
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
              {!isPickup && config?.free_shipping_enabled === true && (
                <div className="mb-4">
                  <FreeShippingProgress
                    subtotal={subtotal}
                    config={config}
                    fulfillmentType={form.fulfillment_type}
                  />
                </div>
              )}
              <div className="mb-4 flex items-center justify-between rounded-xl bg-stone-50 px-3 py-2 text-sm">
                <span className="text-stone-600">Tipo</span>
                <span className="font-medium text-stone-900">
                  {FULFILLMENT_LABELS[form.fulfillment_type]}
                </span>
              </div>
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1" data-testid="checkout-items">
                {items.length === 0 && (
                  <p className="text-sm text-stone-500">Seu carrinho está vazio.</p>
                )}
                {items.map((i) => (
                  <div
                    key={i.cart_key || `${i.item_type || "product"}:${i.combo_id || i.product_id}`}
                    className="flex justify-between gap-3 text-sm"
                  >
                    <span className="min-w-0 text-stone-700">
                      {i.quantity}× {i.item_type === "combo" ? `Combo ${i.name}` : i.name}
                      {i.item_type === "combo" && i.combo_items?.length > 0 && (
                        <span className="mt-0.5 block truncate text-xs text-stone-500">
                          {i.combo_items
                            .map((comboItem) => `${comboItem.quantity}x ${comboItem.name}`)
                            .join(" · ")}
                        </span>
                      )}
                    </span>
                    <span className="shrink-0 font-medium">{brl(i.unit_price * i.quantity)}</span>
                  </div>
                ))}
              </div>
              <div className="border-t border-stone-100 mt-4 pt-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-stone-600">Subtotal</span>
                  <span className="font-medium" data-testid="checkout-subtotal">{brl(subtotal)}</span>
                </div>
                {!isPickup && (
                  <div className="flex justify-between">
                    <span className="text-stone-600">Taxa de entrega {selectedArea ? `(${selectedArea.name})` : ""}</span>
                    <span className="font-medium" data-testid="checkout-delivery-fee">
                      {selectedArea ? brl(deliveryFee) : "—"}
                    </span>
                  </div>
                )}
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
                {config?.checkout_note || STORE_CONFIG_FALLBACK.checkout_note}
              </p>
            </div>
          </aside>
        </form>
          </>
        )}
      </div>
    </div>
  );
}

function FulfillmentOption({ value, label, description, icon: Icon, active }) {
  return (
    <label
      htmlFor={`fulfillment-${value}`}
      className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition-colors ${
        active ? "border-brand bg-brand/5" : "border-stone-200 hover:border-stone-300"
      }`}
      data-testid={`fulfillment-${value}`}
    >
      <RadioGroupItem value={value} id={`fulfillment-${value}`} className="mt-1" />
      <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${active ? "text-brand" : "text-stone-400"}`} />
      <span>
        <span className="block font-medium text-stone-900">{label}</span>
        <span className="mt-0.5 block text-sm text-stone-500">{description}</span>
      </span>
    </label>
  );
}
