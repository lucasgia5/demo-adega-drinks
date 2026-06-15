import { useEffect, useState } from "react";
import AdminLayout from "@/components/AdminLayout";
import api, { brl, formatApiErrorDetail } from "@/lib/api";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Phone, MapPin, ChevronDown } from "lucide-react";

const STATUS = [
  { value: "recebido", label: "Recebido", color: "bg-blue-100 text-blue-800" },
  { value: "em_preparo", label: "Em preparo", color: "bg-amber-100 text-amber-800" },
  { value: "saiu_entrega", label: "Saiu para entrega", color: "bg-purple-100 text-purple-800" },
  { value: "entregue", label: "Entregue", color: "bg-green-100 text-green-800" },
  { value: "cancelado", label: "Cancelado", color: "bg-red-100 text-red-800" },
];
const PAY = { pix: "Pix", dinheiro: "Dinheiro", cartao: "Cartão" };

export default function Orders() {
  const [orders, setOrders] = useState([]);
  const [filter, setFilter] = useState("all");
  const [expanded, setExpanded] = useState({});

  const load = async () => {
    const { data } = await api.get("/orders");
    setOrders(data);
  };
  useEffect(() => { load(); }, []);

  const updateStatus = async (id, status) => {
    try {
      await api.patch(`/orders/${id}/status`, { status });
      toast.success("Status atualizado");
      await load();
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail) || "Erro");
    }
  };

  const list = orders.filter((o) => filter === "all" || o.status === filter);

  return (
    <AdminLayout
      title="Pedidos"
      actions={
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-44" data-testid="orders-filter"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            {STATUS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
          </SelectContent>
        </Select>
      }
    >
      <div className="space-y-3" data-testid="orders-list">
        {list.length === 0 && (
          <div className="bg-white rounded-2xl border border-stone-200 p-10 text-center text-stone-500">
            Nenhum pedido encontrado.
          </div>
        )}
        {list.map((o) => {
          const st = STATUS.find((s) => s.value === o.status) || STATUS[0];
          const isOpen = !!expanded[o.id];
          return (
            <div key={o.id} className="bg-white rounded-2xl border border-stone-200 overflow-hidden" data-testid={`order-row-${o.id}`}>
              <button
                onClick={() => setExpanded((x) => ({ ...x, [o.id]: !x[o.id] }))}
                className="w-full p-4 flex items-center justify-between gap-3 text-left hover:bg-stone-50"
              >
                <div className="min-w-0">
                  <p className="font-medium text-stone-900 truncate">{o.customer_name}</p>
                  <p className="text-xs text-stone-500">
                    #{o.id.slice(0, 8).toUpperCase()} · {new Date(o.created_at).toLocaleString("pt-BR")}
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="font-semibold text-stone-900 hidden sm:inline">{brl(o.total)}</span>
                  <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${st.color}`}>{st.label}</span>
                  <ChevronDown className={`h-4 w-4 text-stone-400 transition-transform ${isOpen ? "rotate-180" : ""}`} />
                </div>
              </button>

              {isOpen && (
                <div className="border-t border-stone-100 p-5 space-y-4">
                  <div className="grid sm:grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-xs uppercase tracking-wider text-stone-500 mb-1">Contato</p>
                      <p className="flex items-center gap-1.5"><Phone className="h-3.5 w-3.5" /> {o.customer_phone}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wider text-stone-500 mb-1">Endereço</p>
                      <p className="flex items-start gap-1.5"><MapPin className="h-3.5 w-3.5 mt-0.5" /> {o.customer_address}</p>
                    </div>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wider text-stone-500 mb-2">Itens</p>
                    <div className="bg-stone-50 rounded-xl divide-y divide-stone-100">
                      {o.items.map((i, idx) => (
                        <div key={idx} className="flex justify-between p-3 text-sm">
                          <span>{i.quantity}× {i.name}</span>
                          <span className="font-medium">{brl(i.unit_price * i.quantity)}</span>
                        </div>
                      ))}
                      <div className="flex justify-between p-3 text-sm bg-white">
                        <span className="text-stone-600">Total</span>
                        <span className="font-serif text-lg font-semibold text-brand">{brl(o.total)}</span>
                      </div>
                    </div>
                  </div>
                  {o.observations && (
                    <div>
                      <p className="text-xs uppercase tracking-wider text-stone-500 mb-1">Observações</p>
                      <p className="text-sm bg-amber-50 border border-amber-100 rounded-xl p-3">{o.observations}</p>
                    </div>
                  )}
                  <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-stone-100">
                    <div className="text-sm">
                      <span className="text-stone-500">Pagamento: </span>
                      <span className="font-medium">{PAY[o.payment_method] || o.payment_method}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-stone-500">Status:</span>
                      <Select value={o.status} onValueChange={(v) => updateStatus(o.id, v)}>
                        <SelectTrigger className="w-48" data-testid={`status-select-${o.id}`}><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {STATUS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </AdminLayout>
  );
}
