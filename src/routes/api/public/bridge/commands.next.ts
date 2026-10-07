import { createFileRoute } from "@tanstack/react-router";

/** POST /api/public/bridge/commands/next — atomically claims the oldest pending command of this device. */
export const Route = createFileRoute("/api/public/bridge/commands/next")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const b = await import("@/lib/bridge.server");
        return b.safe(async () => {
          const dev = await b.authDevice(request);
          if (!dev) return b.erro("token_invalido", 401);
          const { data, error } = await b.supabaseAdmin.rpc("claim_next_command", { p_device_id: dev.id });
          if (error) return b.erro("erro_interno", 500);
          const comando = Array.isArray(data) ? (data[0] ?? null) : null;
          return b.json({ comando });
        })({ request, params: {} });
      },
    },
  },
});
