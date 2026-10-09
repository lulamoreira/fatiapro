import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { CODIGO_RE, CodigoInput, codigoErroCupom, normalizarCodigo, resgatarCupomLogica, type CupomDeps } from "./cupons";

/* ---------- Usuário ---------- */
export const resgatarCupom = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => CodigoInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin: sb } = await import("@/integrations/supabase/client.server");
    const deps: CupomDeps = {
      async tentativasErradasUltimaHora(uid) {
        const { count } = await sb.from("cupom_tentativas").select("id", { count: "exact", head: true })
          .eq("user_id", uid).gte("criado_em", new Date(Date.now() - 3600_000).toISOString());
        return count ?? 0;
      },
      async registrarTentativaErrada(uid) { await sb.from("cupom_tentativas").insert({ user_id: uid }); },
      async resgatar(uid, codigo) {
        const { data: r, error } = await sb.rpc("resgatar_cupom", { p_user: uid, p_codigo: codigo });
        if (error) return { ok: false, erro: codigoErroCupom(error.message) };
        const j = r as { creditos: number; expira_em: string };
        return { ok: true, creditos: j.creditos, expira_em: j.expira_em };
      },
    };
    return resgatarCupomLogica(context.userId, data.codigo, deps);
  });

/* ---------- Admin ---------- */
async function guard(userId: string) {
  const m = await import("./admin.server");
  await m.assertAdmin(userId);
  return m;
}
const POR_PAGINA = 20;

export const adminCupons = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ pagina: z.number().int().min(1).max(10_000) }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin: sb } = await guard(context.userId);
    const de = (data.pagina - 1) * POR_PAGINA;
    const { data: linhas, count, error } = await sb.from("cupons").select("*", { count: "exact" })
      .order("criado_em", { ascending: false }).order("id", { ascending: false }).range(de, de + POR_PAGINA - 1);
    if (error) throw new Error("Falha ao ler os cupons");
    return { linhas: linhas ?? [], total: count ?? 0, por_pagina: POR_PAGINA };
  });

export const adminCupomUsos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ cupom_id: z.string().uuid(), pagina: z.number().int().min(1).max(10_000) }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin: sb } = await guard(context.userId);
    const de = (data.pagina - 1) * POR_PAGINA;
    const { data: linhas, count, error } = await sb.from("cupom_usos").select("id, user_id, criado_em", { count: "exact" })
      .eq("cupom_id", data.cupom_id).order("criado_em", { ascending: false }).order("id", { ascending: false }).range(de, de + POR_PAGINA - 1);
    if (error) throw new Error("Falha ao ler os usos");
    const out = await Promise.all((linhas ?? []).map(async (l) => {
      const { data: u } = await sb.auth.admin.getUserById(l.user_id);
      return { id: l.id, criado_em: l.criado_em, email: u.user?.email ?? l.user_id };
    }));
    return { linhas: out, total: count ?? 0, por_pagina: POR_PAGINA };
  });

const CupomZ = z.object({
  id: z.string().uuid().nullable(),
  codigo: z.string().transform(normalizarCodigo).refine((c) => CODIGO_RE.test(c), "Código: 3 a 30 letras, números ou hífen"),
  creditos: z.number().int().min(1).max(100_000),
  validade_dias: z.number().int().min(1).max(730),
  inicio: z.string().datetime({ offset: true }),
  fim: z.string().datetime({ offset: true }).nullable(),
  limite_total: z.number().int().min(1).max(1_000_000).nullable(),
  so_primeira_compra: z.boolean(),
  ativo: z.boolean(),
}).refine((c) => !c.fim || Date.parse(c.fim) > Date.parse(c.inicio), "O fim precisa ser depois do início");

export const adminSalvarCupom = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => CupomZ.parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin: sb, auditar } = await guard(context.userId);
    const { id, ...campos } = data;
    if (id) {
      const { data: antes } = await sb.from("cupons").select("*").eq("id", id).maybeSingle();
      if (!antes) throw new Error("Cupom não encontrado");
      const { error } = await sb.from("cupons").update(campos).eq("id", id);
      if (error) throw new Error(error.code === "23505" ? "Já existe um cupom com esse código" : "Não foi possível salvar");
      const acao = antes.ativo && !campos.ativo ? "cupom_desativado" : "cupom_editado";
      await auditar(context.userId, acao, context.userId, { cupom_id: id, antes, depois: campos });
    } else {
      const { data: novo, error } = await sb.from("cupons").insert({ ...campos, criado_por: context.userId }).select("id").single();
      if (error) throw new Error(error.code === "23505" ? "Já existe um cupom com esse código" : "Não foi possível criar");
      await auditar(context.userId, "cupom_criado", context.userId, { cupom_id: novo.id, ...campos });
    }
    return { ok: true as const };
  });
