import { createFileRoute } from "@tanstack/react-router";

/** POST /api/public/bridge/jobs/next — atomically claims the oldest queued job of this device. */
export const Route = createFileRoute("/api/public/bridge/jobs/next")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const b = await import("@/lib/bridge.server");
        return b.safe(async () => {
          const dev = await b.authDevice(request);
          if (!dev) return b.erro("token_invalido", 401);
          const { data, error } = await b.supabaseAdmin.rpc("claim_next_job", { p_device_id: dev.id });
          if (error) return b.erro("erro_interno", 500);
          const job = Array.isArray(data) ? data[0] : null;
          if (!job) return b.json({ job: null });
          let arquivo_url: string | null = null;
          if (job.arquivo_path) {
            const { data: s } = await b.supabaseAdmin.storage.from("pecas").createSignedUrl(job.arquivo_path, 900);
            arquivo_url = s?.signedUrl ?? null;
          }
          return b.json({ job, arquivo_url, limite_gasto_usd: dev.limite_gasto_usd });
        })({ request, params: {} });
      },
    },
  },
});
