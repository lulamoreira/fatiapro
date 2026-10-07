import { createFileRoute } from "@tanstack/react-router";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EXT = /\.(3mf|stl|step|stp)$/i;

/**
 * POST /api/public/bridge/jobs/{id}/upload-url — body {tipo:'otimizado'|'original', nome_arquivo}.
 * Returns a signed upload URL at "<user_id>/<job_id>/<tipo>/<nome_arquivo>" in bucket "pecas".
 */
export const Route = createFileRoute("/api/public/bridge/jobs/$id/upload-url")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const b = await import("@/lib/bridge.server");
        return b.safe(async () => {
          const dev = await b.authDevice(request);
          if (!dev) return b.erro("token_invalido", 401);
          if (!UUID.test(params.id)) return b.erro("job_nao_encontrado", 404);
          const { data: job } = await b.supabaseAdmin.from("jobs").select("id, user_id").eq("id", params.id).eq("device_id", dev.id).maybeSingle();
          if (!job) return b.erro("job_nao_encontrado", 404);

          const body = (await b.readJson(request)) as { tipo?: unknown; nome_arquivo?: unknown } | null;
          const tipo = body?.tipo;
          if (tipo !== "otimizado" && tipo !== "original") return b.erro("tipo_invalido", 400, "Use 'otimizado' ou 'original'.");
          const nome = typeof body?.nome_arquivo === "string" ? body.nome_arquivo.trim() : "";
          if (!nome || nome.length > 200 || /[\\/]/.test(nome) || nome === "." || nome === ".." || !EXT.test(nome)) {
            return b.erro("nome_arquivo_invalido", 400, "Sem barras, até 200 caracteres, extensão .3mf/.stl/.step/.stp.");
          }
          const path = `${job.user_id}/${job.id}/${tipo}/${nome}`;
          const { data, error } = await b.supabaseAdmin.storage.from("pecas").createSignedUploadUrl(path, { upsert: true });
          if (error || !data) return b.erro("erro_interno", 500);
          return b.json({ path, upload_url: data.signedUrl });
        })({ request, params });
      },
    },
  },
});
