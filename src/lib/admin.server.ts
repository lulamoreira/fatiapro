/**
 * Server-only helpers for the admin area. Uses the service-role client.
 * Never import from client code; admin.functions.ts loads this inside handlers.
 */
import { setResponseStatus } from "@tanstack/react-start/server";
import type { User } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export { supabaseAdmin };

export class AdminError extends Error {}

/** Throws 403 unless the JWT user is in app_admins. Call FIRST in every handler. */
export async function assertAdmin(userId: string): Promise<void> {
  const { data, error } = await supabaseAdmin.from("app_admins").select("user_id").eq("user_id", userId).maybeSingle();
  if (error || !data) {
    setResponseStatus(403);
    throw new AdminError("Você não tem permissão");
  }
}

/** Walks every page of auth.admin.listUsers until exhausted. */
export async function listAllAuthUsers(): Promise<User[]> {
  const out: User[] = [];
  const perPage = 1000;
  for (let page = 1; ; page++) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage });
    if (error) throw new Error("Falha ao listar usuários");
    out.push(...data.users);
    if (data.users.length < perPage) break;
  }
  return out;
}

/** Reads all rows of a table in 1000-row pages with stable order. */
export async function fetchAll<T>(table: "devices" | "jobs" | "profiles" | "app_admins", cols: string): Promise<T[]> {
  const out: T[] = [];
  const size = 1000;
  for (let from = 0; ; from += size) {
    const { data, error } = await supabaseAdmin.from(table).select(cols).order("criado_em", { ascending: false }).range(from, from + size - 1);
    if (error) throw new Error(`Falha ao ler ${table}`);
    out.push(...((data ?? []) as T[]));
    if (!data || data.length < size) break;
  }
  return out;
}

export const isBanido = (u: Pick<User, "banned_until">, now = Date.now()) =>
  !!u.banned_until && Date.parse(u.banned_until) > now;

export async function auditar(adminId: string, acao: string, alvo: string, detalhe: Record<string, unknown> = {}) {
  const { error } = await supabaseAdmin.from("admin_audit").insert({ admin_id: adminId, acao, alvo_user_id: alvo, detalhe: detalhe as never });
  if (error) throw new Error("Falha ao gravar auditoria");
}
