import { createFileRoute } from "@tanstack/react-router";
import { lerBuscaAjuda } from "@/lib/ajuda";
import { PageHeader } from "@/components/fatia/Chip";
import { CentralAjuda } from "@/components/ajuda/CentralAjuda";

export const Route = createFileRoute("/_authenticated/app/ajuda")({
  head: () => ({
    meta: [
      { title: "Ajuda — FatiaPro" },
      { name: "description", content: "Passo a passo do FatiaPro: instalar a ponte, fazer análises, créditos e orçamentos." },
      { property: "og:title", content: "Ajuda — FatiaPro" },
      { property: "og:description", content: "Passo a passo do FatiaPro: instalar a ponte, fazer análises, créditos e orçamentos." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  validateSearch: lerBuscaAjuda,
  component: AjudaApp,
});

function AjudaApp() {
  const { artigo } = Route.useSearch();
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader titulo="Ajuda" subtitulo="Passo a passo para usar o FatiaPro." />
      <CentralAjuda key={artigo ?? ""} artigoInicial={artigo} />
    </div>
  );
}
