import { useEffect, useState } from "react";
import AdminLayout from "@/components/AdminLayout";
import api, { brl } from "@/lib/api";
import { Package, Tag, ClipboardList, Wallet } from "lucide-react";

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  useEffect(() => {
    (async () => {
      const { data } = await api.get("/admin/stats");
      setStats(data);
    })();
  }, []);

  const cards = [
    { label: "Pedidos", value: stats?.total_orders ?? "—", icon: ClipboardList, color: "bg-brand/10 text-brand", tid: "stat-orders" },
    { label: "Produtos", value: stats?.total_products ?? "—", icon: Package, color: "bg-amber-100 text-amber-700", tid: "stat-products" },
    { label: "Categorias", value: stats?.total_categories ?? "—", icon: Tag, color: "bg-blue-100 text-blue-700", tid: "stat-categories" },
    { label: "Receita", value: stats ? brl(stats.revenue) : "—", icon: Wallet, color: "bg-green-100 text-green-700", tid: "stat-revenue" },
  ];

  return (
    <AdminLayout title="Dashboard">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {cards.map(({ label, value, icon: Icon, color, tid }) => (
          <div key={label} data-testid={tid} className="bg-white border border-stone-200 rounded-2xl p-5">
            <div className={`h-10 w-10 rounded-xl ${color} grid place-items-center`}>
              <Icon className="h-5 w-5" />
            </div>
            <p className="text-stone-500 text-xs uppercase tracking-wider mt-4">{label}</p>
            <p className="font-serif text-3xl font-semibold text-stone-900 mt-1">{value}</p>
          </div>
        ))}
      </div>

      <section className="mt-8">
        <h2 className="font-serif text-xl font-semibold mb-3">Pedidos por status</h2>
        <div className="bg-white rounded-2xl border border-stone-200 p-5">
          {stats?.orders_by_status && Object.keys(stats.orders_by_status).length > 0 ? (
            <ul className="divide-y divide-stone-100">
              {Object.entries(stats.orders_by_status).map(([k, v]) => (
                <li key={k} className="flex justify-between py-2.5 text-sm">
                  <span className="capitalize text-stone-700">{k.replace("_", " ")}</span>
                  <span className="font-semibold">{v}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-stone-500">Nenhum pedido ainda.</p>
          )}
        </div>
      </section>
    </AdminLayout>
  );
}
