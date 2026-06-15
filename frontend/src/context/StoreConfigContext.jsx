import { createContext, useContext, useEffect, useState } from "react";
import api from "@/lib/api";

const StoreCfgContext = createContext({ config: null, loading: true });

export function StoreCfgProvider({ children }) {
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get("/config");
        setConfig(data);
      } catch {
        setConfig({
          name: "Adega",
          primary_color: "#722F37",
          secondary_color: "#C89F53",
          whatsapp_number: "5511999990000",
          banner_url: "",
          tagline: "",
          address: "",
          pix_key: "",
          pix_key_type: "",
          delivery_note: "",
        });
      } finally {
        setLoading(false);
      }
    })();
  }, []);
  return (
    <StoreCfgContext.Provider value={{ config, loading }}>{children}</StoreCfgContext.Provider>
  );
}

export const useStoreConfig = () => useContext(StoreCfgContext);
