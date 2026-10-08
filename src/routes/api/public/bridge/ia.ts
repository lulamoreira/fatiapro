import { createFileRoute } from "@tanstack/react-router";

/**
 * POST /api/public/bridge/ia — the bridge's only path to the AI.
 * ANTHROPIC_API_KEY is read here, server-side, and never returned or logged.
 */
export const Route = createFileRoute("/api/public/bridge/ia")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const b = await import("@/lib/bridge.server");
        const { MODELO_IA, MAX_CHAMADAS_POR_JOB, custoChamadaUSD } = await import("@/lib/ia");
        return b.safe(async () => {
          const dev = await b.authDevice(request);
          if (!dev) return b.erro("token_invalido", 401);
          const len = Number(request.headers.get("content-length") ?? "0");
          if (len > 2 * 1024 * 1024) return b.erro("corpo_grande", 413);
          const raw = await request.text();
          if (raw.length > 2 * 1024 * 1024) return b.erro("corpo_grande", 413);
          let body: Record<string, unknown>;
          try { const v: unknown = JSON.parse(raw); if (!v || typeof v !== "object" || Array.isArray(v)) throw 0; body = v as Record<string, unknown>; }
          catch { return b.erro("dados_invalidos", 400); }

          const job_id = typeof body["job_id"] === "string" ? body["job_id"] : "";
          const modeloReq = body["modelo"];
          const sistema = body["sistema"], usuario = body["usuario"], schema = body["schema"], esforco = body["esforco"];
          const imagens = body["imagens"] ?? [];
          if (!/^[0-9a-f-]{36}$/i.test(job_id) || (modeloReq !== "padrao" && modeloReq !== "premium") || typeof sistema !== "string"
            || typeof usuario !== "string" || !schema || typeof schema !== "object" || !["low", "medium", "high"].includes(esforco as string)
            || !Array.isArray(imagens) || !imagens.every((im) => im && typeof im === "object"
              && ["image/png", "image/jpeg"].includes((im as { tipo?: unknown }).tipo as string) && typeof (im as { base64?: unknown }).base64 === "string")) {
            return b.erro("dados_invalidos", 400);
          }

          const { data: job } = await b.supabaseAdmin.from("jobs").select("id,user_id,device_id,motor,estado,premium").eq("id", job_id).maybeSingle();
          if (!job || job.device_id !== dev.id) return b.erro("nao_encontrado", 404);
          if (job.motor !== "fatiapro") return b.erro("motor_invalido", 403);
          if (!["analisando", "aguardando_aprovacao", "aplicando"].includes(job.estado)) return b.erro("estado_invalido", 409);
          if (modeloReq === "premium" && !job.premium) return b.erro("premium_nao_permitido", 403);

          const [{ data: chamadas, count }, { data: teto }] = await Promise.all([
            b.supabaseAdmin.from("ia_chamadas").select("custo_usd", { count: "exact" }).eq("job_id", job_id)
              .order("criado_em", { ascending: false }).order("id", { ascending: false }).range(0, 99),
            b.supabaseAdmin.from("config_app").select("valor").eq("chave", "custo_teto_job_usd").maybeSingle(),
          ]);
          if ((count ?? 0) >= MAX_CHAMADAS_POR_JOB) return b.erro("limite_chamadas", 429);
          const gasto = (chamadas ?? []).reduce((s, c) => s + Number(c.custo_usd), 0);
          const tetoUsd = Number(teto?.valor ?? 0.5);
          if (!(gasto < tetoUsd)) return b.erro("limite_de_gasto", 429);

          const modelo = MODELO_IA[modeloReq];
          const { data: preco } = await b.supabaseAdmin.from("price_table").select("preco_entrada_usd_por_milhao,preco_saida_usd_por_milhao").eq("modelo", modelo).maybeSingle();
          if (!preco) return b.erro("erro_interno", 500);

          const key = process.env["ANTHROPIC_API_KEY"];
          if (!key) return b.erro("ia_indisponivel", 502);
          const t0 = Date.now();
          let resp: Response;
          try {
            resp = await fetch("https://api.anthropic.com/v1/messages", {
              method: "POST",
              headers: {
                "x-api-key": key,
                "anthropic-version": "2023-06-01",
                "anthropic-beta": "server-side-fallback-2026-07-01",
                "content-type": "application/json",
              },
              body: JSON.stringify({
                model: modelo,
                max_tokens: 16000,
                fallbacks: "default",
                system: [{ type: "text", text: sistema, cache_control: { type: "ephemeral" } }],
                messages: [{
                  role: "user",
                  content: [
                    ...(imagens as { tipo: string; base64: string }[]).map((im) => ({ type: "image", source: { type: "base64", media_type: im.tipo, data: im.base64 } })),
                    { type: "text", text: usuario },
                  ],
                }],
                output_config: { effort: esforco, format: { type: "json_schema", schema } },
              }),
            });
          } catch {
            return b.erro("ia_indisponivel", 502);
          }
          if (!resp.ok) { console.error("[bridge/ia] status", resp.status); return b.erro("ia_indisponivel", 502); }
          const r = (await resp.json().catch(() => null)) as { stop_reason?: string; content?: { type: string; text?: string }[]; usage?: Record<string, number> } | null;
          if (!r) return b.erro("ia_indisponivel", 502);
          const duracao = Date.now() - t0;
          const u = r.usage ?? {};
          const custo = custoChamadaUSD(u, Number(preco.preco_entrada_usd_por_milhao), Number(preco.preco_saida_usd_por_milhao));
          await b.supabaseAdmin.from("ia_chamadas").insert({
            job_id, user_id: job.user_id, modelo,
            entrada: u["input_tokens"] ?? 0, saida: u["output_tokens"] ?? 0,
            cache_leitura: u["cache_read_input_tokens"] ?? 0, cache_escrita: u["cache_creation_input_tokens"] ?? 0,
            custo_usd: custo, duracao_ms: duracao,
          });
          if (r.stop_reason === "refusal") return b.erro("recusa", 422);
          if (r.stop_reason === "max_tokens") return b.erro("incompleta", 422);
          let dados: unknown;
          try { dados = JSON.parse((r.content ?? []).filter((c) => c.type === "text").map((c) => c.text ?? "").join("")); }
          catch { return b.erro("incompleta", 422); }
          return b.json({
            dados,
            uso: { entrada: u["input_tokens"] ?? 0, saida: u["output_tokens"] ?? 0, cache_leitura: u["cache_read_input_tokens"] ?? 0, cache_escrita: u["cache_creation_input_tokens"] ?? 0 },
            custo_usd: custo,
            modelo,
          });
        })({ request, params: {} });
      },
    },
  },
});
