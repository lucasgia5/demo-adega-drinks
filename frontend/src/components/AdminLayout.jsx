import { Link, useLocation, useNavigate } from "react-router-dom";
import { LayoutDashboard, Package, PackageOpen, Tag, ClipboardList, LogOut, Store, Truck } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useStoreConfig } from "@/context/StoreConfigContext";
import { STORE_CONFIG_FALLBACK } from "@/whiteLabelDefaults";

const NAV = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { to: "/admin/produtos", label: "Produtos", icon: Package },
  { to: "/admin/combos", label: "Combos", icon: PackageOpen },
  { to: "/admin/categorias", label: "Categorias", icon: Tag },
  { to: "/admin/pedidos", label: "Pedidos", icon: ClipboardList },
  { to: "/admin/areas", label: "Áreas de entrega", icon: Truck },
];

export default function AdminLayout({ title, children, actions }) {
  const { pathname } = useLocation();
  const { logout } = useAuth();
  const { config } = useStoreConfig();
  const navigate = useNavigate();

  const doLogout = async () => {
    await logout();
    navigate("/admin/login");
  };

  return (
    <div className="min-h-screen bg-brand-cream">
      <aside
        className="hidden lg:flex fixed inset-y-0 left-0 w-64 bg-stone-900 text-stone-100 flex-col"
        data-testid="admin-sidebar"
      >
        <div className="px-6 py-6 border-b border-white/10">
          <p className="text-[10px] uppercase tracking-[0.3em] text-stone-400">Painel</p>
          {config?.logo_url ? (
            <img src={config.logo_url} alt={config?.name || STORE_CONFIG_FALLBACK.name} className="mt-2 h-10 w-auto" />
          ) : (
            <p className="font-serif text-2xl font-semibold mt-1">
              {config?.name || STORE_CONFIG_FALLBACK.name}
            </p>
          )}
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {NAV.map(({ to, label, icon: Icon }) => {
            const active = pathname === to;
            return (
              <Link
                key={to}
                to={to}
                data-testid={`nav-${label.toLowerCase()}`}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                  active ? "bg-brand text-white" : "text-stone-300 hover:bg-white/5"
                }`}
              >
                <Icon className="h-4 w-4" /> {label}
              </Link>
            );
          })}
        </nav>
        <div className="p-3 border-t border-white/10 space-y-1">
          <Link to="/" className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-stone-300 hover:bg-white/5">
            <Store className="h-4 w-4" /> Ver loja
          </Link>
          <button
            onClick={doLogout}
            data-testid="admin-logout"
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-stone-300 hover:bg-white/5"
          >
            <LogOut className="h-4 w-4" /> Sair
          </button>
        </div>
      </aside>

      <div className="lg:pl-64">
        <header className="bg-white border-b border-stone-200 sticky top-0 z-30">
          <div className="px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
            <h1 className="font-serif text-2xl font-semibold text-stone-900">{title}</h1>
            <div className="flex items-center gap-2">{actions}</div>
          </div>
          {/* Mobile nav */}
          <div className="lg:hidden flex gap-1 overflow-x-auto px-3 pb-2 scrollbar-hide">
            {NAV.map(({ to, label, icon: Icon }) => {
              const active = pathname === to;
              return (
                <Link
                  key={to} to={to}
                  className={`px-3 py-1.5 rounded-full text-xs whitespace-nowrap flex items-center gap-1.5 ${
                    active ? "bg-brand text-white" : "bg-stone-100 text-stone-700"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" /> {label}
                </Link>
              );
            })}
          </div>
        </header>
        <main className="px-4 sm:px-6 lg:px-8 py-6">{children}</main>
      </div>
    </div>
  );
}
