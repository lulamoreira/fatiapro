import { createFileRoute } from "@tanstack/react-router";

/** Mercado Pago notifications. Signature checked first; credits only after querying the payment API. */
export const Route = createFileRoute("/api/public/mercadopago/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { processarWebhook } = await import("@/lib/mercadopago");
        const { depsWebhook } = await import("@/lib/mercadopago.server");
        let corpo: unknown = null;
        try { corpo = await request.json(); } catch { corpo = null; }
        try {
          const r = await processarWebhook({ url: request.url, headers: request.headers, corpo }, depsWebhook());
          return Response.json(r.body, { status: r.status });
        } catch (e) {
          console.error("mercadopago webhook:", (e as Error).message);
          return Response.json({ erro: "falha_interna" }, { status: 500 }); // MP will retry
        }
      },
    },
  },
});
