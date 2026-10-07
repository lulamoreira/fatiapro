import { createFileRoute } from "@tanstack/react-router";
import type { Json } from "@/integrations/supabase/types";

const ESTADOS = ["pendente", "executando", "concluido", "erro"] as const;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** POST /api/public/bridge/commands/{id} — body {estado, resposta}; only this device's commands. */
export const Route = createFileRoute("/api/public/bridge/commands/$id")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const b = await import("@/lib/bridge.server");
        return b.safe(async () => {
          const dev = await b.authDevice(request);
          if (!dev) return b.erro("token_invalido", 401);
          if (!UUID.test(params.id)) return b.erro("comando_nao_encontrado", 404);
          const body = (await b.readJson(request)) as { estado?: unknown; resposta?: unknown } | null;
          const estado = body?.estado;
          if (typeof estado !== "string" || !(ESTADOS as readonly string[]).includes(estado)) return b.erro("estado_invalido", 400);
          const patch: { estado: string; resposta?: Json } = { estado };
          if (body?.resposta !== undefined) patch.resposta = body.resposta as Json;
          const { data, error } = await b.supabaseAdmin
            .from("device_commands")
            .update(patch)
            .eq("id", params.id)
            .eq("device_id", dev.id)
            .select("id, estado")
            .maybeSingle();
          if (error) return b.erro("erro_interno", 500);
          if (!data) return b.erro("comando_nao_encontrado", 404);
          return b.json({ ok: true, comando: data });
        })({ request, params });
      },
    },
  },
});
