/**
 * criarAnalise — the ONLY way to create a job. Validates the JWT, then calls the
 * service-role-only SQL function `criar_analise`, which runs every credit rule
 * (cortesia → créditos → teste grátis) in one transaction. Nothing here trusts the browser.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { parametrosCriarAnalise } from "@/lib/analise-params";

const Entrada = z.object({
  device_id: z.string().uuid(),
  roteiro: z.enum(["config_geral", "reduzir_tempo", "checklist", "preco", "producao"]),
  fatiador: z.string().regex(/^[a-z0-9_-]{2,40}$/).nullable(),
  opcoes: z.record(z.string(), z.unknown()).default({}),
  motor: z.enum(["fatiapro", "api", "assinatura"]),
  premium: z.boolean().default(false),
  arquivo_path: z.string().max(500).nullable(),
  nome_peca: z.string().max(300).nullable(),
}).superRefine((d, ctx) => {
  // Produção em lote: opcoes.quantidade opcional, inteiro de 1 a 5000.
  const q = d.opcoes["quantidade"];
  if (q == null) return;
  if (typeof q !== "number" || !Number.isInteger(q) || q < 1 || q > 5000) {
    ctx.addIssue({ code: "custom", message: "quantidade deve ser um inteiro de 1 a 5000", path: ["opcoes", "quantidade"] });
  }
});

export type CriarAnaliseResultado =
  | { job_id: string }
  | { erro: true; codigo: string; detalhe: string; job_pendente?: string };

export const criarAnalise = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => Entrada.parse(d))
  .handler(async ({ data, context }): Promise<CriarAnaliseResultado> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Sempre os 9 parâmetros; opcionais vazios vão como null (undefined quebra o PGRST202).
    const { data: r, error } = await supabaseAdmin.rpc("criar_analise", parametrosCriarAnalise(context.userId, data) as never);
    if (error) {
      console.error("[criarAnalise]", error.code, error.message);
      return { erro: true, codigo: "erro_interno", detalhe: "Não foi possível criar a análise." };
    }
    return r as unknown as CriarAnaliseResultado;
  });
