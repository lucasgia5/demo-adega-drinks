import { Link, useNavigate } from "react-router-dom";
import { ShoppingBag, Search, User, LogOut, ClipboardList } from "lucide-react";
import { useState } from "react";
import { useCart } from "@/context/CartContext";
import { useAuth } from "@/context/AuthContext";
import { useStoreConfig } from "@/context/StoreConfigContext";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuSeparator, DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";

export default function Header({ search, setSearch }) {
  const { count, setIsOpen } = useCart();
  const { user, logout } = useAuth();
  const { config } = useStoreConfig();
  const navigate = useNavigate();
  const [localSearch, setLocalSearch] = useState(search || "");

  const onSubmit = (e) => {
    e.preventDefault();
    setSearch?.(localSearch);
  };

  return (
    <header
      data-testid="storefront-header"
      className="sticky top-0 z-40 bg-white/85 backdrop-blur-md border-b border-stone-200"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center gap-3 sm:gap-6">
        <Link to="/" className="flex items-center gap-2 shrink-0" data-testid="logo-link">
          <span className="font-serif text-xl sm:text-2xl font-semibold text-brand">
            {config?.name || "Adega"}
          </span>
        </Link>

        <form onSubmit={onSubmit} className="flex-1 hidden md:block">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
            <Input
              data-testid="search-input"
              placeholder="Buscar vinhos, cervejas, destilados..."
              value={localSearch}
              onChange={(e) => { setLocalSearch(e.target.value); setSearch?.(e.target.value); }}
              className="pl-9 rounded-xl border-stone-200 bg-stone-50 focus-visible:ring-brand/30"
            />
          </div>
        </form>

        <div className="ml-auto flex items-center gap-2">
          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="rounded-xl" data-testid="user-menu-trigger">
                  <User className="h-4 w-4 mr-2" /> {user.name?.split(" ")[0]}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="text-stone-500 text-xs uppercase tracking-wider">
                  Minha conta
                </DropdownMenuLabel>
                <DropdownMenuItem onClick={() => navigate("/conta")} data-testid="menu-account">
                  <ClipboardList className="h-4 w-4 mr-2" /> Meus pedidos
                </DropdownMenuItem>
                {user.role === "admin" && (
                  <DropdownMenuItem onClick={() => navigate("/admin")} data-testid="menu-admin">
                    Painel administrativo
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={logout} data-testid="menu-logout">
                  <LogOut className="h-4 w-4 mr-2" /> Sair
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/login")}
              className="rounded-xl"
              data-testid="login-link"
            >
              <User className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Entrar</span>
            </Button>
          )}

          <button
            data-testid="cart-button"
            onClick={() => setIsOpen(true)}
            className="relative h-10 w-10 grid place-items-center rounded-xl bg-brand text-white hover:bg-brand-dark transition-colors"
            aria-label="Abrir carrinho"
          >
            <ShoppingBag className="h-4 w-4" />
            {count > 0 && (
              <span
                data-testid="cart-count-badge"
                className="absolute -top-1.5 -right-1.5 bg-brand-gold text-stone-900 text-[10px] font-bold rounded-full h-5 min-w-[20px] px-1 grid place-items-center"
              >
                {count}
              </span>
            )}
          </button>
        </div>
      </div>

      {setSearch && (
        <div className="md:hidden px-4 pb-3">
          <form onSubmit={onSubmit}>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
              <Input
                data-testid="search-input-mobile"
                placeholder="Buscar..."
                value={localSearch}
                onChange={(e) => { setLocalSearch(e.target.value); setSearch?.(e.target.value); }}
                className="pl-9 rounded-xl border-stone-200 bg-stone-50"
              />
            </div>
          </form>
        </div>
      )}
    </header>
  );
}
