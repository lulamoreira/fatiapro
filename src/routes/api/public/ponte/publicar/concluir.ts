import { createFileRoute } from "@tanstack/react-router";

/** POST — re-verifies both signatures, checks the uploaded file, then records the version. */
export const Route = createFileRoute("/api/public/ponte/publicar/concluir")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const s = await import("@/lib/ponte-publicar.server");
        const { concluirPublicacao } = await import("@/lib/ponte-publicar");
        return s.responder(request, (raw) => concluirPublicacao(raw, s.depsReais));
      },
    },
  },
});
