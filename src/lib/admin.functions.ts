/**
 * Admin server functions. EVERY handler: requireSupabaseAuth (validates JWT)
 * → assertAdmin(userId) via service role → only then reads/writes.
 * Server-only modules are loaded inside handlers so nothing leaks to the client.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { situacaoUsuario, type AdminUsuarioLinha, type FiltroAdmin } from "./admin";

const POR_PAGINA = 25;
const DIA = 86_400_000;

async function guard(userId: string) {
  const m = await import("./admin.server");
  await m.assertAdmin(userId);
  return m;
}

type DevRow = { id: string; user_id: string; nome: string; sistema: string; versao_ponte: string | null; ultimo_contato: string | null; revogado: boolean };
type JobRow = { user_id: string; motor: string; criado_em: string };

/* ---------- Painel: indicadores + lista paginada ---------- */
export const adminPainel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      pagina: z.number().int().min(1).max(10_000),
      busca: z.string().max(200).default(""),
      filtro: z.enum(["todos", "ativos", "sem_computador", "bloqueados", "admins"]),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { listAllAuthUsers, fetchAll, isBanido } = await guard(context.userId);
    const now = Date.now();
    const [users, devices, jobs, profiles, admins] = await Promise.all([
      listAllAuthUsers(),
      fetchAll<DevRow>("devices", "id,user_id,ultimo_contato,revogado"),
      fetchAll<JobRow>("jobs", "user_id,motor,criado_em"),
      fetchAll<{ id: string; nome: string | null }>("profiles", "id,nome"),
      fetchAll<{ user_id: string }>("app_admins", "user_id"),
    ]);
    const adminSet = new Set(admins.map((a) => a.user_id));
    const nomes = new Map(profiles.map((p) => [p.id, p.nome]));
    const devPor = new Map<string, { total: number; on: number }>();
    for (const d of devices) {
      if (d.revogado) continue;
      const e = devPor.get(d.user_id) ?? { total: 0, on: 0 };
      e.total++;
      if (d.ultimo_contato && now - Date.parse(d.ultimo_contato) < 60_000) e.on++;
      devPor.set(d.user_id, e);
    }
    const jobPor = new Map<string, { total: number; api: number; assinatura: number; ultimo: number }>();
    const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
    let analisesHoje = 0;
    for (const j of jobs) {
      const t = Date.parse(j.criado_em);
      if (t >= hoje.getTime()) analisesHoje++;
      const e = jobPor.get(j.user_id) ?? { total: 0, api: 0, assinatura: 0, ultimo: 0 };
      e.total++;
      if (j.motor === "api") e.api++; else if (j.motor === "assinatura") e.assinatura++;
      e.ultimo = Math.max(e.ultimo, t);
      jobPor.set(j.user_id, e);
    }

    const linhas: AdminUsuarioLinha[] = users.map((u) => {
      const d = devPor.get(u.id) ?? { total: 0, on: 0 };
      const j = jobPor.get(u.id) ?? { total: 0, api: 0, assinatura: 0, ultimo: 0 };
      const login = u.last_sign_in_at ? Date.parse(u.last_sign_in_at) : 0;
      const base = {
        id: u.id,
        nome: nomes.get(u.id) ?? (u.user_metadata?.["nome"] as string | undefined) ?? null,
        email: u.email ?? "",
        criado_em: u.created_at,
        ultimo_acesso: u.last_sign_in_at ?? null,
        computadores: d.total,
        computadores_on: d.on,
        analises: j.total,
        motor_mais_usado: j.total === 0 ? null : j.api >= j.assinatura ? ("api" as const) : ("assinatura" as const),
        admin: adminSet.has(u.id),
        bloqueado: isBanido(u, now),
        ativo_7d: Math.max(login, j.ultimo) >= now - 7 * DIA,
      };
      return { ...base, situacao: situacaoUsuario(base) };
    });

    const indicadores = {
      usuarios: linhas.length,
      novos_semana: linhas.filter((l) => Date.parse(l.criado_em) >= now - 7 * DIA).length,
      ativos_7d: linhas.filter((l) => l.ativo_7d).length,
      analises_hoje: analisesHoje,
      conectados_agora: [...devPor.values()].reduce((s, e) => s + e.on, 0),
    };

    const q = data.busca.trim().toLowerCase();
    const filtrada = linhas
      .filter((l) => !q || l.email.toLowerCase().includes(q) || (l.nome ?? "").toLowerCase().includes(q))
      .filter((l) => filtrar(l, data.filtro))
      .sort((a, b) => (b.criado_em.localeCompare(a.criado_em)) || b.id.localeCompare(a.id));
    const inicio = (data.pagina - 1) * POR_PAGINA;
    return { indicadores, total: filtrada.length, porPagina: POR_PAGINA, linhas: filtrada.slice(inicio, inicio + POR_PAGINA) };
  });

function filtrar(l: AdminUsuarioLinha, f: FiltroAdmin): boolean {
  switch (f) {
    case "ativos": return l.ativo_7d && !l.bloqueado;
    case "sem_computador": return l.computadores === 0;
    case "bloqueados": return l.bloqueado;
    case "admins": return l.admin;
    default: return true;
  }
}

/* ---------- Detalhes de um usuário ---------- */
export const adminUsuario = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin, isBanido } = await guard(context.userId);
    const { data: au, error } = await supabaseAdmin.auth.admin.getUserById(data.id);
    if (error || !au.user) throw new Error("Usuário não encontrado");
    const u = au.user;
    const [perfil, adm, devs, ult, apiJobs] = await Promise.all([
      supabaseAdmin.from("profiles").select("nome").eq("id", u.id).maybeSingle(),
      supabaseAdmin.from("app_admins").select("user_id").eq("user_id", u.id).maybeSingle(),
      supabaseAdmin.from("devices").select("id,nome,sistema,versao_ponte,ultimo_contato,revogado", { count: "exact" })
        .eq("user_id", u.id).order("criado_em", { ascending: false }).order("id", { ascending: false }).range(0, 99),
      supabaseAdmin.from("jobs").select("id,nome_peca,roteiro,fatiador,estado,criado_em,custo_real,motor", { count: "exact" })
        .eq("user_id", u.id).order("criado_em", { ascending: false }).order("id", { ascending: false }).range(0, 9),
      sumApi(supabaseAdmin, u.id),
    ]);
    return {
      id: u.id,
      nome: perfil.data?.nome ?? null,
      email: u.email ?? "",
      criado_em: u.created_at,
      ultimo_acesso: u.last_sign_in_at ?? null,
      admin: !!adm.data,
      bloqueado: isBanido(u),
      computadores: (devs.data ?? []) as Omit<DevRow, "user_id">[],
      analises: (ult.data ?? []).map((j) => ({ ...j, custo_usd: usd(j.custo_real) })),
      total_analises: ult.count ?? 0,
      gasto_api: apiJobs,
    };
  });

function usd(c: unknown): number | null {
  if (c && typeof c === "object" && "usd" in c) {
    const v = Number((c as { usd: unknown }).usd);
    return Number.isFinite(v) ? v : null;
  }
  return null;
}

async function sumApi(sb: typeof import("@/integrations/supabase/client.server").supabaseAdmin, userId: string) {
  const ini = new Date(); ini.setDate(1); ini.setHours(0, 0, 0, 0);
  let total = 0, mes = 0;
  for (let from = 0; ; from += 1000) {
    const { data, error } = await sb.from("jobs").select("custo_real,criado_em")
      .eq("user_id", userId).eq("motor", "api").order("criado_em", { ascending: false }).order("id", { ascending: false }).range(from, from + 999);
    if (error) throw new Error("Falha ao somar gastos");
    for (const j of data ?? []) {
      const v = usd(j.custo_real) ?? 0;
      total += v;
      if (Date.parse(j.criado_em) >= ini.getTime()) mes += v;
    }
    if (!data || data.length < 1000) break;
  }
  return { mes, total };
}

/* ---------- Ações ---------- */
export const adminAcao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ acao: z.enum(["bloquear", "desbloquear", "tornar_admin", "remover_admin"]), alvo: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin, auditar, AdminError } = await guard(context.userId);
    const { acao, alvo } = data;
    const eu = alvo === context.userId;

    if (acao === "bloquear") {
      if (eu) throw new AdminError("Você não pode bloquear a si mesmo");
      const { error } = await supabaseAdmin.auth.admin.updateUserById(alvo, { ban_duration: "876000h" });
      if (error) throw new Error("Não foi possível bloquear");
      const dv = await supabaseAdmin.from("devices").update({ revogado: true }).eq("user_id", alvo).eq("revogado", false).select("id");
      const jb = await supabaseAdmin.from("jobs").update({ estado: "cancelado" }).eq("user_id", alvo).eq("estado", "na_fila").select("id");
      await auditar(context.userId, acao, alvo, { computadores_revogados: dv.data?.length ?? 0, analises_canceladas: jb.data?.length ?? 0 });
    } else if (acao === "desbloquear") {
      const { error } = await supabaseAdmin.auth.admin.updateUserById(alvo, { ban_duration: "none" });
      if (error) throw new Error("Não foi possível desbloquear");
      await auditar(context.userId, acao, alvo);
    } else if (acao === "tornar_admin") {
      const { error } = await supabaseAdmin.from("app_admins").upsert({ user_id: alvo }, { onConflict: "user_id", ignoreDuplicates: true });
      if (error) throw new Error("Não foi possível tornar administrador");
      await auditar(context.userId, acao, alvo);
    } else {
      if (eu) throw new AdminError("Você não pode remover a si mesmo de administrador");
      const { count } = await supabaseAdmin.from("app_admins").select("user_id", { count: "exact", head: true });
      if ((count ?? 0) <= 1) throw new AdminError("Não é possível remover o último administrador");
      const { error } = await supabaseAdmin.from("app_admins").delete().eq("user_id", alvo);
      if (error) throw new Error("Não foi possível remover administrador");
      await auditar(context.userId, acao, alvo);
    }
    return { ok: true as const };
  });

/* ---------- Histórico de ações ---------- */
export const adminAuditoria = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ pagina: z.number().int().min(1).max(10_000) }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await guard(context.userId);
    const ini = (data.pagina - 1) * POR_PAGINA;
    const { data: rows, count, error } = await supabaseAdmin.from("admin_audit")
      .select("id,admin_id,acao,alvo_user_id,detalhe,criado_em", { count: "exact" })
      .order("criado_em", { ascending: false }).order("id", { ascending: false }).range(ini, ini + POR_PAGINA - 1);
    if (error) throw new Error("Falha ao ler o histórico");
    const ids = [...new Set((rows ?? []).flatMap((r) => [r.admin_id, r.alvo_user_id]))];
    const emails = new Map<string, string>();
    await Promise.all(ids.map(async (id) => {
      const { data: u } = await supabaseAdmin.auth.admin.getUserById(id);
      emails.set(id, u.user?.email ?? id);
    }));
    return {
      total: count ?? 0,
      porPagina: POR_PAGINA,
      linhas: (rows ?? []).map((r) => ({ ...r, detalhe: r.detalhe as Record<string, unknown>, admin_email: emails.get(r.admin_id) ?? "", alvo_email: emails.get(r.alvo_user_id) ?? "" })),
    };
  });
