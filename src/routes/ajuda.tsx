import { createFileRoute, Link } from "@tanstack/react-router";
import { lerBuscaAjuda } from "@/lib/ajuda";
import { Button } from "@/components/ui/button";
import { LinksLegais } from "@/components/fatia/PaginaLegal";
import { CentralAjuda } from "@/components/ajuda/CentralAjuda";

export const Route = createFileRoute("/ajuda")({
  head: () => ({
    meta: [
      { title: "Central de Ajuda — FatiaPro" },
      { name: "description", content: "Como funciona o FatiaPro: ponte no computador, análises de fatiamento, créditos e orçamentos em PDF." },
      { property: "og:title", content: "Central de Ajuda — FatiaPro" },
      { property: "og:description", content: "Como funciona o FatiaPro: ponte no computador, análises de fatiamento, créditos e orçamentos em PDF." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  validateSearch: lerBuscaAjuda,
  component: AjudaPublica,
});

function AjudaPublica() {
  const { artigo } = Route.useSearch();
  return (
    <main className="min-h-screen bg-background px-4 pb-16 pt-6">
      <div className="mx-auto max-w-4xl space-y-6">
        <header className="flex items-center justify-between">
          <Link to="/" className="text-xl font-bold tracking-[-0.02em]">Fatia<span className="text-brand">Pro</span></Link>
          <Button asChild variant="outline" size="sm"><Link to="/auth">Entrar</Link></Button>
        </header>
        <div>
          <h1 className="text-[30px] font-bold leading-tight tracking-[-0.02em]">Ajuda</h1>
          <p className="mt-1 text-sm text-muted-foreground">Passo a passo para usar o FatiaPro.</p>
        </div>
        <CentralAjuda key={artigo ?? ""} artigoInicial={artigo} />
        <LinksLegais className="flex justify-center gap-4 text-xs text-muted-foreground" />
      </div>
    </main>
  );
}
