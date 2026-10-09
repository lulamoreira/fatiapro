import { createFileRoute } from "@tanstack/react-router";
import { PaginaLegal } from "@/components/fatia/PaginaLegal";
import { TERMOS_SECOES, TERMOS_TITULO } from "@/lib/termos-texto";

export const Route = createFileRoute("/termos")({
  head: () => ({
    meta: [
      { title: "Termos de uso — FatiaPro" },
      { name: "description", content: "Termos de uso do FatiaPro: conta, ponte, créditos, reembolso e responsabilidades." },
      { property: "og:title", content: "Termos de uso — FatiaPro" },
      { property: "og:description", content: "Regras de uso do serviço FatiaPro." },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => <PaginaLegal titulo={TERMOS_TITULO} secoes={TERMOS_SECOES} prefixo="t" />,
});
