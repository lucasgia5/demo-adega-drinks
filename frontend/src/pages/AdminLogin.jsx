import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Lock, Store } from "lucide-react";

export default function AdminLogin() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    const res = await login(email, password);
    setBusy(false);
    if (res.ok) {
      if (res.user?.role === "admin") {
        navigate("/admin");
      } else {
        toast.error("Acesso restrito a administradores");
      }
    } else {
      toast.error(res.error);
    }
  };

  return (
    <div className="min-h-screen bg-stone-900 text-white grid place-items-center px-4">
      <div className="w-full max-w-md">
        <Link
          to="/"
          className="mb-6 inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-stone-100 transition-colors hover:bg-white/10"
          data-testid="admin-login-view-store"
        >
          <Store className="h-4 w-4" />
          Ver loja
        </Link>
        <div className="text-center mb-6">
          <div className="inline-flex h-12 w-12 rounded-xl bg-brand grid place-items-center mb-3">
            <Lock className="h-5 w-5" />
          </div>
          <h1 className="font-serif text-3xl font-semibold">Painel administrativo</h1>
          <p className="text-stone-400 text-sm mt-1">Acesso restrito.</p>
        </div>
        <form onSubmit={submit} className="bg-stone-800/60 border border-white/10 rounded-2xl p-8 space-y-4">
          <div>
            <Label htmlFor="adm-email" className="text-stone-300">E-mail</Label>
            <Input
              id="adm-email" data-testid="admin-email"
              type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
              className="bg-stone-900 border-white/10 text-white"
            />
          </div>
          <div>
            <Label htmlFor="adm-pass" className="text-stone-300">Senha</Label>
            <Input
              id="adm-pass" data-testid="admin-password"
              type="password" value={password} onChange={(e) => setPassword(e.target.value)} required
              className="bg-stone-900 border-white/10 text-white"
            />
          </div>
          <Button type="submit" disabled={busy} data-testid="admin-login-submit" className="w-full h-11 rounded-xl bg-brand hover:bg-brand-dark text-white">
            {busy ? "Entrando..." : "Entrar"}
          </Button>
        </form>
      </div>
    </div>
  );
}
