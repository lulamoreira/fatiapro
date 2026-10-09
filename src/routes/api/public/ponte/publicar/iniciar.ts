import { createFileRoute } from "@tanstack/react-router";

/** POST — signed request for an upload URL. No login: both ed25519 signatures are the authorization. */
export const Route = createFileRoute("/api/public/ponte/publicar/iniciar")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const s = await import("@/lib/ponte-publicar.server");
        const { iniciarPublicacao } = await import("@/lib/ponte-publicar");
        return s.responder(request, (raw) => iniciarPublicacao(raw, s.depsReais));
      },
    },
  },
});
