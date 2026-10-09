/**
 * Suspensão de vendas. statusVendas: qualquer usuário logado, devolve só {suspensas, mensagem}.
 * adminVendas/adminSalvarVendas: guard admin + auditoria em admin_audit ("vendas_config").
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { MENSAGEM_VENDAS_MAX, VENDAS_CHAVES, lerConfigVendas, statusPublico } from "./vendas";

export const statusVendas = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { supabaseAdmin: sb } = await import("@/integrations/supabase/client.server");
    const { data } = await sb.from("config_app").select("chave, valor").in("chave", ["vendas_suspensas", "vendas_suspensas_mensagem"]);
    return statusPublico(data);
  });

export const adminVendas = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const m = await import("./admin.server");
    await m.assertAdmin(context.userId);
    const { data } = await m.supabaseAdmin.from("config_app").select("chave, valor").in("chave", [...VENDAS_CHAVES]);
    return lerConfigVendas(data);
  });

export const adminSalvarVendas = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    suspensas: z.boolean(),
    mensagem: z.string().trim().min(1, "Escreva a mensagem").max(MENSAGEM_VENDAS_MAX, `Até ${MENSAGEM_VENDAS_MAX} caracteres`),
  }).strip().parse(d))
  .handler(async ({ data, context }) => {
    const m = await import("./admin.server");
    await m.assertAdmin(context.userId);
    const sb = m.supabaseAdmin;
    const { data: linhas } = await sb.from("config_app").select("chave, valor").in("chave", [...VENDAS_CHAVES]);
    const antes = lerConfigVendas(linhas);
    // "desde" muda só quando liga; ao desligar volta a null.
    const desde = data.suspensas ? (antes.suspensas && antes.desde ? antes.desde : new Date().toISOString()) : null;
    const { error } = await sb.from("config_app").upsert([
      { chave: "vendas_suspensas", valor: data.suspensas as never },
      { chave: "vendas_suspensas_mensagem", valor: data.mensagem as never },
      { chave: "vendas_suspensas_desde", valor: desde as never },
    ], { onConflict: "chave" });
    if (error) throw new Error("Não foi possível salvar");
    await m.auditar(context.userId, "vendas_config", context.userId, { antes, depois: { suspensas: data.suspensas, mensagem: data.mensagem, desde } });
    return { ok: true as const };
  });
