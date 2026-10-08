import { createFileRoute } from "@tanstack/react-router";

/** GET /api/public/bridge/versao?plataforma=macos — highest published bridge version (device token). */
export const Route = createFileRoute("/api/public/bridge/versao")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const b = await import("@/lib/bridge.server");
        const { maisAlta } = await import("@/lib/ponte");
        return b.safe(async () => {
          const dev = await b.authDevice(request);
          if (!dev) return b.erro("token_invalido", 401);
          const plataforma = new URL(request.url).searchParams.get("plataforma");
          if (plataforma !== "macos" && plataforma !== "windows") return b.erro("dados_invalidos", 400, "plataforma deve ser 'macos' ou 'windows'.");
          const { data, error } = await b.supabaseAdmin.from("ponte_versoes")
            .select("versao,arquivo_path,nome_arquivo,sha256,assinatura,notas,tamanho_bytes")
            .eq("plataforma", plataforma).eq("publicada", true)
            .order("criado_em", { ascending: false }).order("id", { ascending: false }).range(0, 999);
          if (error) return b.erro("erro_interno", 500);
          const v = maisAlta(data ?? []);
          if (!v) return b.json({});
          const { data: s, error: e2 } = await b.supabaseAdmin.storage.from("ponte").createSignedUrl(v.arquivo_path, 900, { download: v.nome_arquivo });
          if (e2 || !s) return b.erro("erro_interno", 500);
          return b.json({ versao: v.versao, url: s.signedUrl, sha256: v.sha256, assinatura: v.assinatura, notas: v.notas, tamanho_bytes: Number(v.tamanho_bytes) });
        })({ request, params: {} });
      },
    },
  },
});
