import { createFileRoute, redirect } from "@tanstack/react-router";

// Rota antiga: mantém links e favoritos funcionando.
export const Route = createFileRoute("/_authenticated/app/computador")({
  beforeLoad: () => {
    throw redirect({ to: "/app/configuracoes", replace: true });
  },
});
