import { createContext, useContext, useEffect, useState } from "react";
import api from "@/lib/api";
import { STORE_CONFIG_FALLBACK } from "@/whiteLabelDefaults";

const StoreCfgContext = createContext({ config: null, loading: true });

function hexToHsl(hex) {
  const normalized = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex || "");
  if (!normalized) return null;

  let r = parseInt(normalized[1], 16) / 255;
  let g = parseInt(normalized[2], 16) / 255;
  let b = parseInt(normalized[3], 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const delta = max - min;
    s = l > 0.5 ? delta / (2 - max - min) : delta / (max + min);
    if (max === r) h = (g - b) / delta + (g < b ? 6 : 0);
    if (max === g) h = (b - r) / delta + 2;
    if (max === b) h = (r - g) / delta + 4;
    h /= 6;
  }

  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

function darkenHex(hex, amount = 0.18) {
  const normalized = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex || "");
  if (!normalized) return null;
  const toHex = (value) => Math.max(0, Math.round(value * (1 - amount))).toString(16).padStart(2, "0");
  return `#${toHex(parseInt(normalized[1], 16))}${toHex(parseInt(normalized[2], 16))}${toHex(parseInt(normalized[3], 16))}`;
}

function applyBrandColors(config) {
  const root = document.documentElement;
  const primary = config?.primary_color;
  const secondary = config?.secondary_color;
  const primaryHsl = hexToHsl(primary);
  const secondaryHsl = hexToHsl(secondary);

  if (primary) {
    root.style.setProperty("--brand-primary", primary);
    root.style.setProperty("--brand-primary-dark", darkenHex(primary) || primary);
  }
  if (primaryHsl) {
    root.style.setProperty("--primary", primaryHsl);
    root.style.setProperty("--ring", primaryHsl);
  }
  if (secondary) {
    root.style.setProperty("--brand-secondary", secondary);
  }
  if (secondaryHsl) {
    root.style.setProperty("--accent", secondaryHsl);
  }
}

export function StoreCfgProvider({ children }) {
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get("/config");
        setConfig(data);
      } catch {
        setConfig(STORE_CONFIG_FALLBACK);
      } finally {
        setLoading(false);
      }
    })();
  }, []);
  useEffect(() => {
    if (config) applyBrandColors(config);
  }, [config]);
  return (
    <StoreCfgContext.Provider value={{ config, loading }}>{children}</StoreCfgContext.Provider>
  );
}

export const useStoreConfig = () => useContext(StoreCfgContext);
