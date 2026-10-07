import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Chip } from "@/components/fatia/Chip";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Entrar — FatiaPro" },
      { name: "description", content: "Entre no FatiaPro com e-mail e senha, link mágico ou Google." },
      { property: "og:title", content: "Entrar — FatiaPro" },
      { property: "og:description", content: "Acesse suas análises de fatiamento." },
    ],
  }),
  component: AuthPage,
});

type Modo = "entrar" | "criar" | "link";

function AuthPage() {
  const navigate = useNavigate();
  const [modo, setModo] = useState<Modo>("entrar");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [nome, setNome] = useState("");
  const [loading, setLoading] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/app/nova-analise" });
    });
    const { data } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session) navigate({ to: "/app/nova-analise" });
    });
    return () => data.subscription.unsubscribe();
  }, [navigate]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setAviso(null);
    try {
      if (modo === "entrar") {
        const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
        if (error) throw error;
      } else if (modo === "criar") {
        const { error } = await supabase.auth.signUp({
          email,
          password: senha,
          options: { emailRedirectTo: window.location.origin + "/auth", data: { nome } },
        });
        if (error) throw error;
        setAviso("Conta criada! Confira seu e-mail para confirmar o cadastro.");
      } else {
        const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: window.location.origin + "/auth" } });
        if (error) throw error;
        setAviso("Enviamos um link de acesso para o seu e-mail.");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível continuar.");
    } finally {
      setLoading(false);
    }
  }

  async function google() {
    const r = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin + "/auth" });
    if (r.error) toast.error("Não foi possível entrar com Google.");
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="glass w-full max-w-md rounded-[22px] p-8">
        <Link to="/" className="text-2xl font-bold">
          Fatia<span className="text-brand">Pro</span>
        </Link>
        <h1 className="mt-6 text-2xl font-bold">{modo === "criar" ? "Criar conta" : "Entrar"}</h1>
        <div className="mt-4 flex flex-wrap gap-2">
          <Chip selected={modo === "entrar"} onClick={() => setModo("entrar")}>E-mail e senha</Chip>
          <Chip selected={modo === "link"} onClick={() => setModo("link")}>Link mágico</Chip>
          <Chip selected={modo === "criar"} onClick={() => setModo("criar")}>Criar conta</Chip>
        </div>
        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          {modo === "criar" && (
            <div className="space-y-1.5">
              <Label htmlFor="nome">Nome</Label>
              <Input id="nome" value={nome} onChange={(e) => setNome(e.target.value)} required maxLength={80} />
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="email">E-mail</Label>
            <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
          </div>
          {modo !== "link" && (
            <div className="space-y-1.5">
              <Label htmlFor="senha">Senha</Label>
              <Input id="senha" type="password" value={senha} onChange={(e) => setSenha(e.target.value)} required minLength={6} autoComplete={modo === "criar" ? "new-password" : "current-password"} />
            </div>
          )}
          {aviso && <p className="rounded-xl bg-success/15 p-3 text-sm text-success">{aviso}</p>}
          <Button type="submit" className="w-full" size="lg" disabled={loading}>
            {loading ? "Aguarde…" : modo === "entrar" ? "Entrar" : modo === "criar" ? "Criar conta" : "Enviar link"}
          </Button>
        </form>
        <div className="my-6 flex items-center gap-3 text-xs text-muted-foreground">
          <span className="h-px flex-1 bg-border" />ou<span className="h-px flex-1 bg-border" />
        </div>
        <Button variant="outline" size="lg" className="w-full" onClick={google}>
          Continuar com Google
        </Button>
      </div>
    </main>
  );
}
