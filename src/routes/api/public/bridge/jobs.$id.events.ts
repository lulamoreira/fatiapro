import { createFileRoute } from "@tanstack/react-router";
import type { Json } from "@/integrations/supabase/types";

const TIPOS = ["progresso", "proposta", "aprovacao", "pedido_outra", "resultado", "erro", "cancelamento"] as const;
const ESTADOS = ["na_fila", "analisando", "aguardando_aprovacao", "aplicando", "concluido", "erro", "cancelado", "limite_de_gasto"] as const;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * POST /api/public/bridge/jobs/{id}/events — bridge writes an event (+ optional state/result/cost).
 * GET  /api/public/bridge/jobs/{id}/events?depois=<ts> — bridge reads events after a timestamp.
 */
export const Route = createFileRoute("/api/public/bridge/jobs/$id/events")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const b = await import("@/lib/bridge.server");
        return b.safe(async () => {
          const dev = await b.authDevice(request);
          if (!dev) return b.erro("token_invalido", 401);
          if (!UUID.test(params.id)) return b.erro("job_nao_encontrado", 404);
          const { data: job } = await b.supabaseAdmin.from("jobs").select("id").eq("id", params.id).eq("device_id", dev.id).maybeSingle();
          if (!job) return b.erro("job_nao_encontrado", 404);

          const body = await b.readJson(request);
          const tipo = body?.tipo;
          if (typeof tipo !== "string" || !(TIPOS as readonly string[]).includes(tipo)) return b.erro("tipo_invalido", 400);
          const novo = body?.novo_estado;
          if (novo != null && (typeof novo !== "string" || !(ESTADOS as readonly string[]).includes(novo))) return b.erro("estado_invalido", 400);

          const { data: ev, error } = await b.supabaseAdmin
            .from("job_events")
            .insert({ job_id: job.id, tipo, conteudo: (body?.conteudo ?? {}) as Json })
            .select("id, criado_em")
            .single();
          if (error || !ev) return b.erro("erro_interno", 500);

          const patch: { estado?: string; resultado?: Json; custo_real?: Json } = {};
          if (typeof novo === "string") patch.estado = novo;
          if (body?.resultado !== undefined) patch.resultado = body.resultado as Json;
          if (body?.custo_real !== undefined) patch.custo_real = body.custo_real as Json;
          if (Object.keys(patch).length) {
            const { error: e2 } = await b.supabaseAdmin.from("jobs").update(patch).eq("id", job.id);
            if (e2) return b.erro("erro_interno", 500);
          }
          return b.json({ ok: true, evento: ev });
        })({ request, params });
      },
      GET: async ({ request, params }) => {
        const b = await import("@/lib/bridge.server");
        return b.safe(async () => {
          const dev = await b.authDevice(request);
          if (!dev) return b.erro("token_invalido", 401);
          if (!UUID.test(params.id)) return b.erro("job_nao_encontrado", 404);
          const { data: job } = await b.supabaseAdmin.from("jobs").select("id").eq("id", params.id).eq("device_id", dev.id).maybeSingle();
          if (!job) return b.erro("job_nao_encontrado", 404);
          const depois = new URL(request.url).searchParams.get("depois");
          let q = b.supabaseAdmin
            .from("job_events")
            .select("id, tipo, conteudo, criado_em", { count: "exact" })
            .eq("job_id", job.id)
            .order("criado_em", { ascending: true })
            .order("id", { ascending: true })
            .range(0, 499);
          if (depois) {
            if (Number.isNaN(Date.parse(depois))) return b.erro("depois_invalido", 400);
            q = q.gt("criado_em", depois);
          }
          const { data, error, count } = await q;
          if (error) return b.erro("erro_interno", 500);
          return b.json({ eventos: data ?? [], total: count ?? 0 });
        })({ request, params });
      },
    },
  },
});
