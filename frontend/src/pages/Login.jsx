import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import Header from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export default function Login() {
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
      toast.success("Bem-vindo de volta!");
      navigate(res.user?.role === "admin" ? "/admin" : "/");
    } else {
      toast.error(res.error);
    }
  };

  return (
    <div className="min-h-screen bg-brand-cream">
      <Header />
      <div className="max-w-md mx-auto px-4 py-12">
        <div className="bg-white rounded-2xl border border-stone-200 p-8">
          <h1 className="font-serif text-3xl font-semibold text-stone-900">Entrar</h1>
          <p className="text-stone-500 text-sm mt-1">Acesse sua conta para ver seus pedidos.</p>
          <form onSubmit={submit} className="mt-6 space-y-4">
            <div>
              <Label htmlFor="email">E-mail</Label>
              <Input id="email" data-testid="login-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div>
              <Label htmlFor="password">Senha</Label>
              <Input id="password" data-testid="login-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>
            <Button type="submit" disabled={busy} data-testid="login-submit" className="w-full h-11 rounded-xl bg-brand hover:bg-brand-dark text-white">
              {busy ? "Entrando..." : "Entrar"}
            </Button>
          </form>
          <p className="text-sm text-stone-600 mt-4 text-center">
            Não tem conta? <Link className="text-brand font-medium" to="/cadastro" data-testid="goto-register">Cadastrar</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
