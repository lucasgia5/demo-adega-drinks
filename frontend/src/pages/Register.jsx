import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import Header from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: "", email: "", phone: "", password: "" });
  const [busy, setBusy] = useState(false);

  const onChange = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    const res = await register(form);
    setBusy(false);
    if (res.ok) {
      toast.success("Cadastro realizado!");
      navigate("/");
    } else {
      toast.error(res.error);
    }
  };

  return (
    <div className="min-h-screen bg-brand-cream">
      <Header />
      <div className="max-w-md mx-auto px-4 py-12">
        <div className="bg-white rounded-2xl border border-stone-200 p-8">
          <h1 className="font-serif text-3xl font-semibold text-stone-900">Criar conta</h1>
          <p className="text-stone-500 text-sm mt-1">Receba descontos e acompanhe seus pedidos.</p>
          <form onSubmit={submit} className="mt-6 space-y-4">
            <div>
              <Label htmlFor="name">Nome</Label>
              <Input id="name" data-testid="register-name" value={form.name} onChange={(e) => onChange("name", e.target.value)} required />
            </div>
            <div>
              <Label htmlFor="email">E-mail</Label>
              <Input id="email" data-testid="register-email" type="email" value={form.email} onChange={(e) => onChange("email", e.target.value)} required />
            </div>
            <div>
              <Label htmlFor="phone">Telefone</Label>
              <Input id="phone" data-testid="register-phone" value={form.phone} onChange={(e) => onChange("phone", e.target.value)} />
            </div>
            <div>
              <Label htmlFor="password">Senha (mín. 6)</Label>
              <Input id="password" data-testid="register-password" type="password" value={form.password} onChange={(e) => onChange("password", e.target.value)} minLength={6} required />
            </div>
            <Button type="submit" disabled={busy} data-testid="register-submit" className="w-full h-11 rounded-xl bg-brand hover:bg-brand-dark text-white">
              {busy ? "Criando..." : "Criar conta"}
            </Button>
          </form>
          <p className="text-sm text-stone-600 mt-4 text-center">
            Já tem conta? <Link className="text-brand font-medium" to="/login" data-testid="goto-login">Entrar</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
