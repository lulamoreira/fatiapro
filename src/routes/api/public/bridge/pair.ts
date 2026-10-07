import { createFileRoute } from "@tanstack/react-router";

/** POST /api/public/bridge/pair — exchanges a 6-digit code for a device token (shown once). */
export const Route = createFileRoute("/api/public/bridge/pair")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const b = await import("@/lib/bridge.server");
        return b.safe(async () => {
          const ip = b.clientIp(request);
          const desde = new Date(Date.now() - 60_000).toISOString();
          const { count } = await b.supabaseAdmin
            .from("pair_attempts")
            .select("id", { count: "exact", head: true })
            .eq("ip", ip)
            .gte("criado_em", desde);
          if ((count ?? 0) >= 5) return b.erro("muitas_tentativas", 429, "Aguarde 1 minuto e tente de novo.");

          const body = await b.readJson(request);
          const codigo = typeof body?.codigo === "string" ? body.codigo.trim() : "";
          const nome = typeof body?.nome === "string" ? body.nome.trim().slice(0, 80) : "";
          const sistema = body?.sistema;
          const versao = typeof body?.versao_ponte === "string" ? body.versao_ponte.slice(0, 40) : null;
          if (!/^\d{6}$/.test(codigo) || !nome || (sistema !== "macos" && sistema !== "windows")) {
            return b.erro("dados_invalidos", 400, "Envie codigo (6 dígitos), nome e sistema ('macos'|'windows').");
          }

          const hash = await b.sha256Hex(codigo);
          const { data: pc } = await b.supabaseAdmin
            .from("pairing_codes")
            .select("id, user_id")
            .eq("codigo_hash", hash)
            .eq("usado", false)
            .gt("expira_em", new Date().toISOString())
            .order("expira_em", { ascending: false })
            .limit(1)
            .maybeSingle();
          if (!pc) {
            await b.supabaseAdmin.from("pair_attempts").insert({ ip });
            return b.erro("codigo_invalido", 400, "Código inválido, expirado ou já usado.");
          }

          // Mark used atomically (only if still unused) to prevent double pairing.
          const { data: marcado } = await b.supabaseAdmin
            .from("pairing_codes")
            .update({ usado: true })
            .eq("id", pc.id)
            .eq("usado", false)
            .select("id");
          if (!marcado?.length) return b.erro("codigo_invalido", 400, "Código já usado.");

          const token = b.randomTokenBase64Url(32);
          const { data: dev, error } = await b.supabaseAdmin
            .from("devices")
            .insert({ user_id: pc.user_id, nome, sistema, versao_ponte: versao, token_hash: await b.sha256Hex(token), ultimo_contato: new Date().toISOString() })
            .select("id")
            .single();
          if (error || !dev) return b.erro("erro_interno", 500);
          return b.json({ device_id: dev.id, token });
        })({ request, params: {} });
      },
    },
  },
});
