import { lazy, Suspense } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
const ColorirPeca = lazy(() =>
  import("@/components/colorir/ColorirPeca").then((m) => ({ default: m.ColorirPeca })),
);
export const Route = createFileRoute("/_authenticated/app/colorir")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Colorir peça — FatiaPro" },
      {
        name: "description",
        content:
          "Pinte regiões, olhos e detalhes de um STL no navegador e baixe um 3MF colorido para seu fatiador.",
      },
      { property: "og:title", content: "Colorir peça — FatiaPro" },
      {
        property: "og:description",
        content:
          "Pintura manual gratuita de peças 3D e sugestões por foto com IA, prévia e aplicação opcional por 1 crédito.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ColorirPage,
  errorComponent: ({ reset }) => (
    <div className="space-y-3">
      <h1 className="text-xl font-bold">Não foi possível abrir Colorir peça</h1>
      <p className="text-muted-foreground">Tente novamente ou escolha um STL menor.</p>
      <Button variant="outline" onClick={reset}>
        Tentar novamente
      </Button>
    </div>
  ),
});
function ColorirPage() {
  const { user } = Route.useRouteContext();
  return (
    <Suspense
      fallback={
        <p className="text-sm text-muted-foreground" role="status">
          Abrindo Colorir peça…
        </p>
      }
    >
      <ColorirPeca userId={user.id} />
    </Suspense>
  );
}
