/**
 * meuPlano — read-only summary of the caller's plan. The service-role client is
 * used ONLY to run saldo_creditos / vencer_lotes for context.userId (those
 * functions are service_role-only) and to read the single config key limite_diario_gratis; every other read goes through the RLS client.
 * Day boundaries use America/Sao_Paulo, like criar_analise.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { PlanoInfo } from "./plano";
import { DIAS_TESTE } from "./plano";

const DIA_MS = 86_400_000;
const LIMITE_GRATIS_PADRAO = 20; // fallback when config_app has no valid limite_diario_gratis

/** Start of the current São Paulo day as a UTC Date. */
function inicioDiaSP(agora: Date): Date {
  const ymd = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(agora);
  const offset = new Intl.DateTimeFormat("en-US", { timeZone: "America/Sao_Paulo", timeZoneName: "longOffset" })
    .formatToParts(agora).find((p) => p.type === "timeZoneName")?.value.replace("GMT", "") || "-03:00";
  return new Date(`${ymd}T00:00:00${offset}`);
}

export const meuPlano = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<PlanoInfo> => {
    const { supabase, userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const agora = new Date();
    const hoje = inicioDiaSP(agora).toISOString();

    const venc = await supabaseAdmin.rpc("vencer_lotes" as never, { p_user: userId } as never);
    if (venc.error) console.error("[meuPlano] vencer_lotes", venc.error.code);
    const saldoR = await supabaseAdmin.rpc("saldo_creditos" as never, { p_user: userId } as never);
    if (saldoR.error) throw new Error("Falha ao ler o saldo");
    const saldo = Number(saldoR.data ?? 0);
    const cfg = await supabaseAdmin.from("config_app").select("valor").eq("chave", "limite_diario_gratis").maybeSingle();
    const limCfg = Number(cfg.data?.valor);
    const limite = Number.isInteger(limCfg) && limCfg > 0 ? limCfg : LIMITE_GRATIS_PADRAO;

    const [adm, prox, teste, cort, jobsHoje] = await Promise.all([
      supabase.from("app_admins").select("user_id").eq("user_id", userId).maybeSingle(),
      supabase.from("creditos_lotes").select("restante, expira_em").eq("user_id", userId).gt("restante", 0)
        .not("expira_em", "is", null).gt("expira_em", agora.toISOString())
        .order("expira_em", { ascending: true }).order("id", { ascending: true }).range(0, 0),
      supabase.from("testes_gratis").select("inicio, fim").eq("user_id", userId).maybeSingle(),
      supabase.from("cortesias").select("tipo, por_dia, premium, inicio, fim").eq("user_id", userId).eq("ativa", true)
        .lte("inicio", agora.toISOString()).order("criado_em", { ascending: false }).order("id", { ascending: false }).range(0, 9),
      supabase.from("jobs").select("id, estado, fonte", { count: "exact" }).eq("user_id", userId)
        .in("fonte", ["teste", "cortesia", "gratis"]).gte("criado_em", hoje)
        .order("criado_em", { ascending: false }).order("id", { ascending: false }).range(0, 999),
    ]);

    // job_contou: refunded-before-proposal jobs don't count.
    const hojeJobs = jobsHoje.data ?? [];
    const falhos = hojeJobs.filter((j) => ["erro", "cancelado", "limite_de_gasto"].includes(j.estado)).map((j) => j.id);
    let comProposta = new Set<string>();
    if (falhos.length) {
      const { data } = await supabase.from("job_events").select("job_id").in("job_id", falhos).eq("tipo", "proposta").range(0, 999);
      comProposta = new Set((data ?? []).map((e) => e.job_id));
    }
    const contou = (j: { id: string; estado: string }) => !falhos.includes(j.id) || comProposta.has(j.id);
    const contar = (fonte: string) => hojeJobs.filter((j) => j.fonte === fonte && contou(j)).length;

    let testeInfo: PlanoInfo["teste"] = null;
    if (teste.data) {
      const ativo = agora < new Date(teste.data.fim);
      const dia = Math.floor((inicioDiaSP(agora).getTime() - inicioDiaSP(new Date(teste.data.inicio)).getTime()) / DIA_MS) + 1;
      const dia_atual = Math.min(DIAS_TESTE, Math.max(1, dia));
      let pend: string | null = null;
      if (ativo) {
        const { data: ult } = await supabase.from("jobs").select("id").eq("user_id", userId).eq("fonte", "teste").eq("estado", "concluido")
          .order("criado_em", { ascending: false }).order("id", { ascending: false }).range(0, 0);
        const id = ult?.[0]?.id;
        if (id) {
          const { data: fb } = await supabase.from("feedback_respostas").select("id").eq("job_id", id).maybeSingle();
          if (!fb) pend = id;
        }
      }
      testeInfo = { ativo, dia_atual, dias_restantes: Math.max(0, DIAS_TESTE - dia_atual), fim: teste.data.fim, usado_hoje: contar("teste") >= 1, questionario_pendente_job: pend };
    }

    const c = (cort.data ?? []).find((x) => !x.fim || new Date(x.fim) >= agora);
    const p0 = prox.data?.[0];
    return {
      saldo,
      proximo_vencimento: p0?.expira_em ? { quantidade: p0.restante, expira_em: p0.expira_em } : null,
      teste: testeInfo,
      cortesia: c ? { tipo: c.tipo as "creditos" | "uso_diario", por_dia: c.por_dia, premium: c.premium, fim: c.fim, usadas_hoje: contar("cortesia") } : null,
      gratis_hoje: { usadas: hojeJobs.filter((j) => j.fonte === "gratis").length, limite },
      is_admin: !!adm.data,
    };
  });
