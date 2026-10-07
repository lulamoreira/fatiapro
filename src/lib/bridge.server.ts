/**
 * Server-only helpers for the bridge (ponte) HTTP API.
 * Uses the service-role client — never import from client code.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}

export const erro = (codigo: string, status: number, detalhe?: string) =>
  json(detalhe ? { erro: codigo, detalhe } : { erro: codigo }, status);

export async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
}

export function randomTokenBase64Url(bytes = 32): string {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  let bin = "";
  for (const b of arr) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function clientIp(request: Request): string {
  return (
    request.headers.get("cf-connecting-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "desconhecido"
  );
}

export async function readJson(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const v: unknown = await request.json();
    return typeof v === "object" && v !== null && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

export interface BridgeDevice {
  id: string;
  user_id: string;
  limite_gasto_usd: number;
}

/** Authenticates the bridge by its device token. Returns null when invalid. */
export async function authDevice(request: Request): Promise<BridgeDevice | null> {
  const h = request.headers.get("authorization") ?? "";
  const m = /^Bearer\s+(.+)$/i.exec(h);
  if (!m) return null;
  const hash = await sha256Hex(m[1].trim());
  const { data, error } = await supabaseAdmin
    .from("devices")
    .select("id, user_id, limite_gasto_usd")
    .eq("token_hash", hash)
    .eq("revogado", false)
    .maybeSingle();
  if (error || !data) return null;
  return { id: data.id, user_id: data.user_id, limite_gasto_usd: Number(data.limite_gasto_usd) };
}

/** Wraps a handler so every failure is JSON, never HTML. */
export function safe(fn: (ctx: { request: Request; params: Record<string, string> }) => Promise<Response>) {
  return async (ctx: { request: Request; params: Record<string, string> }) => {
    try {
      return await fn(ctx);
    } catch (e) {
      console.error("[bridge]", e);
      return erro("erro_interno", 500);
    }
  };
}

export { supabaseAdmin };
