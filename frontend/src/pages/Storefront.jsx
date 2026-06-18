import { useEffect, useState, useMemo } from "react";
import api from "@/lib/api";
import Header from "@/components/Header";
import ProductCard from "@/components/ProductCard";
import CartDrawer from "@/components/CartDrawer";
import AgeGate from "@/components/AgeGate";
import { useStoreConfig } from "@/context/StoreConfigContext";
import { STORE_CONFIG_FALLBACK } from "@/whiteLabelDefaults";
import { MapPin, Truck } from "lucide-react";

export default function Storefront() {
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [activeCat, setActiveCat] = useState("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const { config, loading: configLoading } = useStoreConfig();

  useEffect(() => {
    (async () => {
      try {
        const [{ data: cats }, { data: prods }] = await Promise.all([
          api.get("/categories"),
          api.get("/products"),
        ]);
        setCategories(cats);
        setProducts(prods);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filtered = useMemo(() => {
    const term = (search || "").trim().toLowerCase();
    return products.filter((p) => {
      if (activeCat !== "all" && p.category_id !== activeCat) return false;
      if (term && !p.name.toLowerCase().includes(term)) return false;
      return true;
    });
  }, [products, activeCat, search]);

  return (
    <div className="min-h-screen bg-brand-cream">
      <AgeGate config={config} loading={configLoading} />
      <Header search={search} setSearch={setSearch} />

      {/* Hero */}
      <section
        className="relative h-[280px] sm:h-[360px] lg:h-[420px] overflow-hidden"
        data-testid="hero-section"
      >
        {config?.banner_url ? (
          <img src={config.banner_url} alt="Banner" className="absolute inset-0 h-full w-full object-cover" />
        ) : (
          <div className="absolute inset-0 bg-brand" />
        )}
        <div className="absolute inset-0 hero-overlay" />
        <div className="relative max-w-7xl mx-auto h-full px-4 sm:px-6 lg:px-8 flex flex-col justify-end pb-10">
          <p className="text-brand-gold uppercase tracking-[0.3em] text-xs font-semibold">
            {config?.tagline || "Bem-vindo"}
          </p>
          <h1 className="font-serif text-white text-4xl sm:text-5xl lg:text-6xl font-semibold tracking-tight mt-2 text-balance">
            {config?.name || STORE_CONFIG_FALLBACK.name}
          </h1>
          <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-white/90 text-sm">
            {config?.address && (
              <span className="flex items-center gap-1.5">
                <MapPin className="h-4 w-4" /> {config.address}
              </span>
            )}
            {config?.delivery_note && (
              <span className="flex items-center gap-1.5">
                <Truck className="h-4 w-4" /> {config.delivery_note}
              </span>
            )}
          </div>
        </div>
      </section>

      {/* Sticky categories */}
      <section
        aria-label="Categorias de produtos"
        className="sticky top-[116px] md:top-16 z-30 border-y border-stone-200 bg-brand-cream/95 backdrop-blur-md shadow-sm"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <div
            className="flex items-center gap-2 overflow-x-auto scroll-smooth overscroll-x-contain scrollbar-hide snap-x snap-proximity"
            data-testid="category-list"
          >
            <CategoryChip
              label="Todos"
              active={activeCat === "all"}
              onClick={() => setActiveCat("all")}
              testId="category-chip-all"
            />
            {categories.map((c) => (
              <CategoryChip
                key={c.id}
                label={c.name}
                active={activeCat === c.id}
                onClick={() => setActiveCat(c.id)}
                testId={`category-chip-${c.id}`}
              />
            ))}
          </div>
        </div>
      </section>

      {/* Products grid */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6 pb-20">
        <div className="flex items-end justify-between mb-4">
          <h2 className="font-serif text-2xl sm:text-3xl font-semibold text-stone-900">
            {activeCat === "all"
              ? "Nossa carta"
              : categories.find((c) => c.id === activeCat)?.name || "Produtos"}
          </h2>
          <span className="text-xs uppercase tracking-wider text-stone-500" data-testid="product-count">
            {filtered.length} {filtered.length === 1 ? "item" : "itens"}
          </span>
        </div>

        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="aspect-[4/5] bg-stone-100 rounded-2xl animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 text-stone-500" data-testid="empty-products">
            Nenhum produto encontrado.
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
            {filtered.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        )}
      </section>

      <CartDrawer />
    </div>
  );
}

function CategoryChip({ label, active, onClick, testId }) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-testid={testId}
      aria-pressed={active}
      className={`shrink-0 snap-start px-4 py-2 rounded-full whitespace-nowrap text-sm font-medium transition-colors border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 focus-visible:ring-offset-2 ${
        active
          ? "bg-brand text-white border-brand shadow-sm"
          : "bg-white text-stone-700 border-stone-200 hover:border-brand/50 hover:text-brand"
      }`}
    >
      {label}
    </button>
  );
}
