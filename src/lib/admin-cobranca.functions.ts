/**
 * Admin billing server functions. EVERY handler: requireSupabaseAuth → guard()
 * (assertAdmin → 403 unless the JWT user is in app_admins) → only then reads/writes.
 * Every write records a row in admin_audit (who, what, target, values).
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  CONFIG_CHAVES, inicioDiaSP, inicioPeriodo, resumoFeedback, resumoFinanceiro,
  type ChamadaRow, type FeedbackRow, type JobFinRow, type MovRow,
} from "./admin-cobranca";
import { resumoReceita } from "./mercadopago";

const POR_PAGINA = 20;
const Uuid = z.string().uuid();
const Motivo = z.string().trim().min(3, "Motivo obrigatório (mínimo 3 caracteres)").max(300);
const PeriodoZ = z.enum(["hoje", "7d", "30d", "tudo"]);

async function guard(userId: string) {
  const m = await import("./admin.server");
  await m.assertAdmin(userId);
  return m;
}
type Admin = Awaited<ReturnType<typeof guard>>["supabaseAdmin"];

/** Reads every page (1000 rows) of a query built per page. */
async function todas<T>(build: (de: number, ate: number) => PromiseLike<{ data: T[] | null; error: unknown }>): Promise<T[]> {
  const out: T[] = [];
  for (let de = 0; ; de += 1000) {
    const { data, error } = await build(de, de + 999);
    if (error) throw new Error("Falha ao ler dados");
    out.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  return out;
}

function erroSql(e: { message?: string } | null, padrao: string): never {
  const m = e?.message ?? "";
  if (m.includes("saldo_insuficiente")) throw new Error("O usuário não tem saldo suficiente para remover essa quantidade.");
  if (m.includes("motivo_obrigatorio")) throw new Error("Motivo obrigatório (mínimo 3 caracteres).");
  throw new Error(padrao);
}

async function configNum(sb: Admin, chave: string, padrao: number): Promise<number> {
  const { data } = await sb.from("config_app").select("valor").eq("chave", chave).maybeSingle();
  const v = Number(data?.valor);
  return Number.isFinite(v) && v > 0 ? v : padrao;
}

/* ---------- Créditos de um usuário ---------- */
export const adminCreditosUsuario = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: Uuid, pagina: z.number().int().min(1).max(10_000).default(1) }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin: sb } = await guard(context.userId);
    const agora = new Date().toISOString();
    const de = (data.pagina - 1) * POR_PAGINA;
    const [saldo, lotes, mov, cort, teste] = await Promise.all([
      sb.rpc("saldo_creditos", { p_user: data.id }),
      sb.from("creditos_lotes").select("id, origem, quantidade, restante, expira_em", { count: "exact" }).eq("user_id", data.id).gt("restante", 0)
        .or(`expira_em.is.null,expira_em.gt.${agora}`).order("criado_em", { ascending: false }).order("id", { ascending: false }).range(0, 99),
      sb.from("creditos_movimentos").select("id, tipo, quantidade, motivo, criado_em, job_id, jobs(nome_peca)", { count: "exact" }).eq("user_id", data.id)
        .order("criado_em", { ascending: false }).order("id", { ascending: false }).range(de, de + POR_PAGINA - 1),
      sb.from("cortesias").select("id, tipo, por_dia, premium, inicio, fim, motivo", { count: "exact" }).eq("user_id", data.id).eq("ativa", true).eq("tipo", "uso_diario")
        .order("criado_em", { ascending: false }).order("id", { ascending: false }).range(0, 0),
      sb.from("testes_gratis").select("inicio, fim").eq("user_id", data.id).maybeSingle(),
    ]);
    return {
      saldo: Number(saldo.data ?? 0),
      lotes: lotes.data ?? [],
      extrato: mov.data ?? [], extrato_total: mov.count ?? 0, por_pagina: POR_PAGINA,
      cortesia: cort.data?.[0] ?? null,
      teste: teste.data ?? null,
    };
  });

export const adminDarCreditos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ alvo: Uuid, qtd: z.number().int().min(1).max(100_000), validade_dias: z.number().int().min(1).max(730), motivo: Motivo }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin: sb, auditar } = await guard(context.userId);
    const { error } = await sb.rpc("admin_dar_creditos", { p_user: data.alvo, p_qtd: data.qtd, p_origem: "cortesia", p_validade_dias: data.validade_dias, p_motivo: data.motivo, p_admin: context.userId });
    if (error) erroSql(error, "Não foi possível dar créditos");
    await auditar(context.userId, "dar_creditos", data.alvo, { quantidade: data.qtd, validade_dias: data.validade_dias, motivo: data.motivo });
    return { ok: true as const };
  });

export const adminAjustarCreditos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ alvo: Uuid, modo: z.enum(["adicionar", "remover"]), qtd: z.number().int().min(1).max(100_000), motivo: Motivo }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin: sb, auditar } = await guard(context.userId);
    const { error } = data.modo === "adicionar"
      ? await sb.rpc("admin_dar_creditos", { p_user: data.alvo, p_qtd: data.qtd, p_origem: "ajuste", p_validade_dias: 365, p_motivo: data.motivo, p_admin: context.userId })
      : await sb.rpc("admin_remover_creditos", { p_user: data.alvo, p_qtd: data.qtd, p_motivo: data.motivo, p_admin: context.userId });
    if (error) erroSql(error, "Não foi possível ajustar os créditos");
    await auditar(context.userId, data.modo === "adicionar" ? "ajustar_creditos" : "remover_creditos", data.alvo, { modo: data.modo, quantidade: data.qtd, motivo: data.motivo });
    return { ok: true as const };
  });

export const adminDarCortesia = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ alvo: Uuid, por_dia: z.number().int().min(1).max(20), premium: z.boolean(), fim: z.string().date().nullable(), motivo: Motivo }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin: sb, auditar } = await guard(context.userId);
    const inicio = inicioDiaSP(new Date());
    // End date is inclusive: valid until 23:59:59 of that São Paulo day.
    const fim = data.fim ? new Date(new Date(`${data.fim}T00:00:00-03:00`).getTime() + 86_400_000 - 1000) : null;
    if (fim && fim < inicio) throw new Error("A data final não pode ser antes de hoje.");
    const enc = await sb.from("cortesias").update({ ativa: false }).eq("user_id", data.alvo).eq("tipo", "uso_diario").eq("ativa", true).select("id");
    const { data: nova, error } = await sb.from("cortesias").insert({
      user_id: data.alvo, tipo: "uso_diario", por_dia: data.por_dia, premium: data.premium,
      inicio: inicio.toISOString(), fim: fim?.toISOString() ?? null, motivo: data.motivo, admin_id: context.userId, ativa: true,
    }).select("id").single();
    if (error) throw new Error("Não foi possível criar a cortesia");
    await auditar(context.userId, "dar_cortesia", data.alvo, { cortesia_id: nova.id, por_dia: data.por_dia, premium: data.premium, fim: data.fim, motivo: data.motivo, encerradas: enc.data?.length ?? 0 });
    return { ok: true as const };
  });

export const adminEncerrarCortesia = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ alvo: Uuid, id: Uuid }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin: sb, auditar } = await guard(context.userId);
    const { data: r, error } = await sb.from("cortesias").update({ ativa: false }).eq("id", data.id).eq("user_id", data.alvo).select("id");
    if (error || !r?.length) throw new Error("Cortesia não encontrada");
    await auditar(context.userId, "encerrar_cortesia", data.alvo, { cortesia_id: data.id });
    return { ok: true as const };
  });

export const adminReiniciarTeste = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ alvo: Uuid }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin: sb, auditar } = await guard(context.userId);
    const { data: antes } = await sb.from("testes_gratis").select("inicio, fim").eq("user_id", data.alvo).maybeSingle();
    const agora = new Date();
    const fim = new Date(agora.getTime() + 14 * 86_400_000);
    const { error } = await sb.from("testes_gratis").upsert({ user_id: data.alvo, inicio: agora.toISOString(), fim: fim.toISOString() }, { onConflict: "user_id" });
    if (error) throw new Error("Não foi possível reiniciar o teste");
    await auditar(context.userId, "reiniciar_teste", data.alvo, { antes, inicio: agora.toISOString(), fim: fim.toISOString() });
    return { ok: true as const };
  });

/* ---------- Feedback ---------- */
export const adminFeedback = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ periodo: PeriodoZ, pagina: z.number().int().min(1).max(10_000) }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin: sb } = await guard(context.userId);
    const ini = inicioPeriodo(data.periodo)?.toISOString() ?? null;
    const base = () => {
      const q = sb.from("feedback_respostas").select("fez_sentido, imprimiu, problemas, tempo_poupado");
      return ini ? q.gte("criado_em", ini) : q;
    };
    const todasR = await todas<FeedbackRow>((de, ate) => base().order("criado_em", { ascending: false }).order("id", { ascending: false }).range(de, ate));
    const de = (data.pagina - 1) * POR_PAGINA;
    let lq = sb.from("feedback_respostas").select("id, user_id, job_id, fez_sentido, imprimiu, problemas, tempo_poupado, comentario, criado_em, jobs(nome_peca, roteiro)", { count: "exact" });
    if (ini) lq = lq.gte("criado_em", ini);
    const { data: linhas, count, error } = await lq.order("criado_em", { ascending: false }).order("id", { ascending: false }).range(de, de + POR_PAGINA - 1);
    if (error) throw new Error("Falha ao ler o feedback");
    const emails = new Map<string, string>();
    await Promise.all([...new Set((linhas ?? []).map((l) => l.user_id))].map(async (id) => {
      const { data: u } = await sb.auth.admin.getUserById(id);
      emails.set(id, u.user?.email ?? id);
    }));
    return {
      resumo: resumoFeedback(todasR),
      total: count ?? 0, por_pagina: POR_PAGINA,
      linhas: (linhas ?? []).map((l) => ({ ...l, email: emails.get(l.user_id) ?? "" })),
    };
  });

/* ---------- Financeiro ---------- */
export const adminFinanceiro = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ periodo: z.enum(["hoje", "7d", "30d"]) }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin: sb } = await guard(context.userId);
    const ini = inicioPeriodo(data.periodo)!.toISOString();
    const [chamadas, jobs, movimentos, config, pedidos] = await Promise.all([
      todas<ChamadaRow>((de, ate) => sb.from("ia_chamadas").select("job_id, user_id, modelo, custo_usd").gte("criado_em", ini).order("criado_em", { ascending: false }).order("id", { ascending: false }).range(de, ate)),
      todas<JobFinRow>((de, ate) => sb.from("jobs").select("id, user_id, fonte, roteiro, premium").gte("criado_em", ini).order("criado_em", { ascending: false }).order("id", { ascending: false }).range(de, ate)),
      todas<MovRow>((de, ate) => sb.from("creditos_movimentos").select("tipo, quantidade").in("tipo", ["reserva", "estorno"]).gte("criado_em", ini).order("criado_em", { ascending: false }).order("id", { ascending: false }).range(de, ate)),
      sb.from("config_app").select("chave, valor").in("chave", [...CONFIG_CHAVES]),
      todas<{ valor_centavos: number; metodo: string | null }>((de, ate) => sb.from("pedidos").select("valor_centavos, metodo").eq("status", "aprovado").gte("pago_em", ini).order("pago_em", { ascending: false }).order("id", { ascending: false }).range(de, ate)),
    ]);
    const cfg = Object.fromEntries((config.data ?? []).map((c) => [c.chave, Number(c.valor)]));
    const cambio = cfg["cambio_brl"] && cfg["cambio_brl"] > 0 ? cfg["cambio_brl"] : 5.5;
    const r = resumoFinanceiro({ chamadas, jobs, movimentos, cambio });
    const porUser = new Map<string, { custo: number; jobs: Set<string> }>();
    for (const c of chamadas) {
      const e = porUser.get(c.user_id) ?? { custo: 0, jobs: new Set<string>() };
      e.custo += Number(c.custo_usd || 0); e.jobs.add(c.job_id); porUser.set(c.user_id, e);
    }
    const top = [...porUser.entries()].sort((a, b) => b[1].custo - a[1].custo || a[0].localeCompare(b[0])).slice(0, 10);
    const topLinhas = await Promise.all(top.map(async ([id, e]) => {
      const { data: u } = await sb.auth.admin.getUserById(id);
      return { id, email: u.user?.email ?? id, analises: e.jobs.size, custo_usd: e.custo };
    }));
    const receita = resumoReceita(pedidos, cfg["taxa_pix_pct"] ?? 1, cfg["taxa_cartao_pct"] ?? 5, r.total_brl);
    return { ...r, cambio, top: topLinhas, config: cfg, receita };
  });

/** Today's AI spend vs. alert threshold — shown on every admin tab. */
export const adminAlertaGasto = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin: sb } = await guard(context.userId);
    const ini = inicioDiaSP(new Date()).toISOString();
    const linhas = await todas<{ custo_usd: number }>((de, ate) => sb.from("ia_chamadas").select("custo_usd").gte("criado_em", ini).order("criado_em", { ascending: false }).order("id", { ascending: false }).range(de, ate));
    const hoje = linhas.reduce((s, l) => s + Number(l.custo_usd || 0), 0);
    const limite = await configNum(sb, "alerta_gasto_usd_dia", 5);
    return { hoje_usd: hoje, limite_usd: limite, alerta: hoje > limite };
  });

export const adminSalvarConfig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    valores: z.object(Object.fromEntries(CONFIG_CHAVES.map((k) => [k, z.number().finite().positive("Precisa ser maior que zero").max(1_000_000)])) as Record<(typeof CONFIG_CHAVES)[number], z.ZodNumber>),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin: sb, auditar } = await guard(context.userId);
    const { data: antes } = await sb.from("config_app").select("chave, valor").in("chave", [...CONFIG_CHAVES]);
    const v = data.valores as Record<string, number>;
    if (!Number.isInteger(v["limite_diario_gratis"]) || !Number.isInteger(v["uso_justo_por_dia"])) throw new Error("Limites por dia precisam ser números inteiros.");
    const { error } = await sb.from("config_app").upsert(CONFIG_CHAVES.map((k) => ({ chave: k, valor: v[k] as never })), { onConflict: "chave" });
    if (error) throw new Error("Não foi possível salvar");
    await auditar(context.userId, "config_cobranca", context.userId, { antes: Object.fromEntries((antes ?? []).map((a) => [a.chave, a.valor])), depois: v });
    return { ok: true as const };
  });
