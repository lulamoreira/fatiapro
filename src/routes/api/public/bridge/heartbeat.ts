import { createFileRoute } from "@tanstack/react-router";
import type { Json } from "@/integrations/supabase/types";

/** POST /api/public/bridge/heartbeat — updates last contact and the bridge report. */
export const Route = createFileRoute("/api/public/bridge/heartbeat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const b = await import("@/lib/bridge.server");
        return b.safe(async () => {
          const dev = await b.authDevice(request);
          if (!dev) return b.erro("token_invalido", 401);
          const body = (await b.readJson(request)) ?? {};
          const patch: { ultimo_contato: string; relatorio?: Json; versao_ponte?: string } = { ultimo_contato: new Date().toISOString() };
          if (body.relatorio && typeof body.relatorio === "object") patch.relatorio = body.relatorio as Json;
          if (typeof body.versao_ponte === "string") patch.versao_ponte = body.versao_ponte.slice(0, 40);
          const { error } = await b.supabaseAdmin.from("devices").update(patch).eq("id", dev.id);
          if (error) return b.erro("erro_interno", 500);
          return b.json({ limite_gasto_usd: dev.limite_gasto_usd });
        })({ request, params: {} });
      },
    },
  },
});
