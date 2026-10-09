/**
 * Admin: packages, orders and Mercado Pago events. Every handler: requireSupabaseAuth
 * → assertAdmin (403) first; every write is audited in admin_audit.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const POR_PAGINA = 20;
async function guard(userId: string) {
  const m = await import("./admin.server");
  await m.assertAdmin(userId);
  return m;
}

export const adminPacotes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin: sb } = await guard(context.userId);
    const { data, error } = await sb.from("pacotes").select("*", { count: "exact" })
      .order("ordem", { ascending: true }).order("id", { ascending: true }).range(0, 99);
    if (error) throw new Error("Falha ao ler os pacotes");
    return data ?? [];
  });

const PacoteZ = z.object({
  id: z.string().uuid().nullable(),
  nome: z.string().trim().min(1).max(80),
  creditos: z.number().int().min(1).max(100_000),
  preco_centavos: z.number().int().min(1).max(10_000_000),
  validade_meses: z.number().int().min(1).max(60),
  destaque: z.boolean(), ativo: z.boolean(),
  ordem: z.number().int().min(0).max(1000),
});

export const adminSalvarPacote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => PacoteZ.parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin: sb, auditar } = await guard(context.userId);
    const { id, ...campos } = data;
    if (id) {
      const { data: antes } = await sb.from("pacotes").select("*").eq("id", id).maybeSingle();
      if (!antes) throw new Error("Pacote não encontrado");
      const { error } = await sb.from("pacotes").update(campos).eq("id", id);
      if (error) throw new Error("Não foi possível salvar");
      await auditar(context.userId, "pacote_editado", context.userId, { pacote_id: id, antes, depois: campos });
    } else {
      const { data: novo, error } = await sb.from("pacotes").insert(campos).select("id").single();
      if (error) throw new Error("Não foi possível criar");
      await auditar(context.userId, "pacote_criado", context.userId, { pacote_id: novo.id, ...campos });
    }
    return { ok: true as const };
  });

const STATUS = ["pendente", "aprovado", "recusado", "cancelado", "estornado", "expirado"] as const;

export const adminPedidos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ status: z.enum(STATUS).nullable(), pagina: z.number().int().min(1).max(10_000) }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin: sb } = await guard(context.userId);
    const de = (data.pagina - 1) * POR_PAGINA;
    let q = sb.from("pedidos").select("id, user_id, creditos, valor_centavos, status, metodo, mp_payment_id, criado_em, pago_em, pacotes(nome)", { count: "exact" });
    if (data.status) q = q.eq("status", data.status);
    const { data: linhas, count, error } = await q.order("criado_em", { ascending: false }).order("id", { ascending: false }).range(de, de + POR_PAGINA - 1);
    if (error) throw new Error("Falha ao ler os pedidos");
    const emails = new Map<string, string>();
    await Promise.all([...new Set((linhas ?? []).map((l) => l.user_id))].map(async (id) => {
      const { data: u } = await sb.auth.admin.getUserById(id);
      emails.set(id, u.user?.email ?? id);
    }));
    return { linhas: (linhas ?? []).map((l) => ({ ...l, email: emails.get(l.user_id) ?? "" })), total: count ?? 0, por_pagina: POR_PAGINA };
  });

export const adminMpEventos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ pagina: z.number().int().min(1).max(10_000) }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin: sb } = await guard(context.userId);
    const de = (data.pagina - 1) * POR_PAGINA;
    const { data: linhas, count, error } = await sb.from("mp_eventos").select("*", { count: "exact" })
      .order("criado_em", { ascending: false }).order("id", { ascending: false }).range(de, de + POR_PAGINA - 1);
    if (error) throw new Error("Falha ao ler os eventos");
    return { linhas: linhas ?? [], total: count ?? 0, por_pagina: POR_PAGINA };
  });
