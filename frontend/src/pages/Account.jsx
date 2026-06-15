import { useEffect, useState } from "react";
import api, { brl } from "@/lib/api";
import Header from "@/components/Header";
import { useAuth } from "@/context/AuthContext";

const STATUS_LABELS = {
  recebido: "Recebido",
  em_preparo: "Em preparo",
  saiu_entrega: "Saiu para entrega",
  entregue: "Entregue",
  cancelado: "Cancelado",
};
const STATUS_COLORS = {
  recebido: "bg-blue-100 text-blue-800",
  em_preparo: "bg-amber-100 text-amber-800",
  saiu_entrega: "bg-purple-100 text-purple-800",
  entregue: "bg-green-100 text-green-800",
  cancelado: "bg-red-100 text-red-800",
};

export default function Account() {
  const { user } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get("/orders/mine");
        setOrders(data);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className="min-h-screen bg-brand-cream">
      <Header />
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="font-serif text-3xl sm:text-4xl font-semibold text-stone-900">Olá, {user?.name?.split(" ")[0]}</h1>
        <p className="text-stone-500 mt-1">Acompanhe seus pedidos.</p>

        <div className="mt-8 space-y-4" data-testid="my-orders">
          {loading && <p className="text-stone-500">Carregando...</p>}
          {!loading && orders.length === 0 && (
            <div className="bg-white rounded-2xl border border-stone-200 p-10 text-center text-stone-500">
              Você ainda não fez pedidos.
            </div>
          )}
          {orders.map((o) => (
            <div key={o.id} className="bg-white rounded-2xl border border-stone-200 p-5">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <p className="text-xs uppercase tracking-wider text-stone-500">
                    Pedido #{o.id.slice(0, 8).toUpperCase()}
                  </p>
                  <p className="text-stone-500 text-sm">{new Date(o.created_at).toLocaleString("pt-BR")}</p>
                </div>
                <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${STATUS_COLORS[o.status]}`}>
                  {STATUS_LABELS[o.status]}
                </span>
              </div>
              <div className="mt-4 space-y-1 text-sm">
                {o.items.map((i, idx) => (
                  <div key={idx} className="flex justify-between text-stone-700">
                    <span>{i.quantity}× {i.name}</span>
                    <span>{brl(i.unit_price * i.quantity)}</span>
                  </div>
                ))}
              </div>
              <div className="flex justify-between items-center mt-4 pt-3 border-t border-stone-100">
                <span className="text-stone-500 text-sm">Total</span>
                <span className="font-serif text-xl font-semibold text-brand">{brl(o.total)}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
