import { createFileRoute, Link } from "@tanstack/react-router";
import { BotaoAjuda } from "@/components/ajuda/BotaoAjuda";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { FilePlus2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useIsAdmin } from "@/hooks/use-is-admin";
import { gravarVisao, lerVisao, primeiroNome, type Visao } from "@/lib/inicio";
import { Segmented } from "@/components/fatia/Chip";
import { Button } from "@/components/ui/button";
import { VisaoUsuario } from "@/components/inicio/VisaoUsuario";
import { VisaoAdmin } from "@/components/inicio/VisaoAdmin";

export const Route = createFileRoute("/_authenticated/app/")({
  head: () => ({
    meta: [
      { title: "Início — FatiaPro" },
      { name: "description", content: "Seus números do FatiaPro: análises, tempo economizado, créditos e orçamentos." },
      { property: "og:title", content: "Início — FatiaPro" },
      { property: "og:description", content: "Seus números do FatiaPro: análises, tempo economizado, créditos e orçamentos." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: InicioPage,
});

function InicioPage() {
  const isAdmin = useIsAdmin();
  const [visao, setVisao] = useState<Visao>("conta");
  useEffect(() => setVisao(lerVisao()), []);
  const { data: nome } = useQuery({
    queryKey: ["meu-nome"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return "";
      const { data } = await supabase.from("profiles").select("nome").eq("id", u.user.id).maybeSingle();
      return primeiroNome(data?.nome, u.user.email);
    },
    staleTime: 5 * 60_000,
  });
  const hoje = new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" });
  const mostrarNegocio = isAdmin && visao === "negocio";

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-3"><h1 className="text-[30px] font-bold leading-tight tracking-[-0.02em]">Olá{nome ? `, ${nome}` : ""}</h1><BotaoAjuda tela="inicio" /></div>
          <p className="mt-1 text-muted-foreground first-letter:uppercase">{hoje}</p>
        </div>
        <Button asChild size="lg" className="bg-brand shadow-brand text-primary-foreground">
          <Link to="/app/nova-analise"><FilePlus2 className="size-4" aria-hidden />Nova análise</Link>
        </Button>
      </div>
      {isAdmin && (
        <Segmented label="Visão" value={visao} onChange={(v) => { setVisao(v); gravarVisao(v); }}
          options={[{ id: "conta", label: "Minha conta" }, { id: "negocio", label: "Negócio" }]} />
      )}
      {mostrarNegocio ? <VisaoAdmin /> : <VisaoUsuario />}
    </div>
  );
}
