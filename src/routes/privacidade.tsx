import { createFileRoute } from "@tanstack/react-router";
import { PaginaLegal } from "@/components/fatia/PaginaLegal";
import { PRIVACIDADE_SECOES, PRIVACIDADE_TITULO } from "@/lib/termos-texto";

export const Route = createFileRoute("/privacidade")({
  head: () => ({
    meta: [
      { title: "Política de privacidade — FatiaPro" },
      { name: "description", content: "Como o FatiaPro trata seus dados pessoais conforme a LGPD." },
      { property: "og:title", content: "Política de privacidade — FatiaPro" },
      { property: "og:description", content: "Dados tratados, bases legais e seus direitos na LGPD." },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => <PaginaLegal titulo={PRIVACIDADE_TITULO} secoes={PRIVACIDADE_SECOES} prefixo="p" />,
});
