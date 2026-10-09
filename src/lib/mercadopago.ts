/**
 * Mercado Pago (Checkout Pro) — pure logic, dependencies injected so it is testable.
 * Rules: price/credits come only from the database; credits are released only after
 * the server QUERIES the payment on the Mercado Pago API (never trusts the notification body).
 */
import { z } from "zod";

export const SITE = "https://fatiapro.lovable.app";

/** Browser input for criarCompra: only the package id. Any extra field (price!) is dropped. */
export const CompraInput = z.object({ pacote_id: z.string().uuid() }).strip();

export interface PacoteRow { id: string; nome: string; creditos: number; preco_centavos: number }

export function montarPreferencia(p: PacoteRow, pedidoId: string, email: string | null, agora: Date) {
  const volta = `${SITE}/app/plano?pedido=${pedidoId}`;
  return {
    items: [{ id: p.id, title: `FatiaPro — ${p.nome}`, quantity: 1, unit_price: p.preco_centavos / 100, currency_id: "BRL" }],
    external_reference: pedidoId,
    ...(email ? { payer: { email } } : {}),
    back_urls: { success: volta, failure: volta, pending: volta },
    auto_return: "approved",
    notification_url: `${SITE}/api/public/mercadopago/webhook`,
    statement_descriptor: "FATIAPRO",
    expires: true,
    expiration_date_to: new Date(agora.getTime() + 2 * 3600_000).toISOString(),
    payment_methods: { excluded_payment_types: [{ id: "ticket" }], installments: 12 },
  };
}

/** Test credentials return sandbox_init_point. */
export function urlCheckout(token: string, r: { init_point?: string; sandbox_init_point?: string }): string | null {
  return (token.startsWith("TEST-") ? r.sandbox_init_point : r.init_point) ?? r.init_point ?? null;
}

/* ---------------- Webhook signature ---------------- */
const hex = (b: ArrayBuffer) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");

function iguais(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

export function normalizarDataId(id: string): string {
  return /[a-z]/i.test(id) ? id.toLowerCase() : id;
}

/** x-signature "ts=...,v1=..."; manifest `id:<data.id>;request-id:<x-request-id>;ts:<ts>;`; HMAC-SHA256 hex. */
export async function assinaturaValida(xSignature: string | null, xRequestId: string | null, dataId: string | null, secret: string): Promise<boolean> {
  if (!xSignature || !xRequestId || !dataId || !secret) return false;
  const partes = Object.fromEntries(xSignature.split(",").map((p) => p.trim().split("=", 2) as [string, string]));
  const ts = partes["ts"], v1 = partes["v1"];
  if (!ts || !v1) return false;
  const manifesto = `id:${normalizarDataId(dataId)};request-id:${xRequestId};ts:${ts};`;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = hex(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(manifesto)));
  return iguais(mac, v1.toLowerCase());
}

/* ---------------- Webhook processing ---------------- */
export interface Pagamento { id: string | number; status: string; transaction_amount: number; currency_id: string; external_reference: string | null; payment_type_id: string | null }
export interface PedidoRow { id: string; status: string; valor_centavos: number }

export interface WebhookDeps {
  secret: string;
  buscarPagamento(id: string): Promise<Pagamento | null>;
  buscarPedido(id: string): Promise<PedidoRow | null>;
  creditar(pedidoId: string, paymentId: string, metodo: string | null): Promise<void>;
  estornar(pedidoId: string, motivo: string): Promise<void>;
  /** Changes status only while the order is still 'pendente'. */
  marcarSePendente(pedidoId: string, status: "recusado" | "cancelado", paymentId: string): Promise<void>;
  registrarEvento(e: { payment_id: string | null; status: string | null; valido: boolean }): Promise<void>;
}

export interface WebhookReq { url: string; headers: { get(n: string): string | null }; corpo: unknown }

export async function processarWebhook(req: WebhookReq, deps: WebhookDeps): Promise<{ status: number; body: Record<string, unknown> }> {
  const u = new URL(req.url);
  const dataId = u.searchParams.get("data.id") ?? u.searchParams.get("id");
  const corpo = (req.corpo && typeof req.corpo === "object" ? req.corpo : {}) as Record<string, unknown>;
  const tipo = u.searchParams.get("type") ?? u.searchParams.get("topic") ?? (typeof corpo["type"] === "string" ? corpo["type"] : null);
  const valido = await assinaturaValida(req.headers.get("x-signature"), req.headers.get("x-request-id"), dataId, deps.secret);
  if (!valido) {
    await deps.registrarEvento({ payment_id: dataId, status: null, valido: false }).catch(() => {});
    return { status: 401, body: { erro: "assinatura_invalida" } };
  }
  if (tipo !== "payment" || !dataId) {
    await deps.registrarEvento({ payment_id: dataId, status: tipo, valido: true }).catch(() => {});
    return { status: 200, body: { ok: true, ignorado: true } };
  }
  const pg = await deps.buscarPagamento(dataId);
  await deps.registrarEvento({ payment_id: dataId, status: pg?.status ?? "nao_encontrado", valido: true }).catch(() => {});
  if (!pg || !pg.external_reference) return { status: 200, body: { ok: true, ignorado: true } };
  const pedido = await deps.buscarPedido(pg.external_reference);
  if (!pedido) return { status: 200, body: { ok: true, ignorado: true } };
  const pid = String(pg.id);

  if (pg.status === "approved") {
    if (Math.round(Number(pg.transaction_amount) * 100) !== pedido.valor_centavos || pg.currency_id !== "BRL") {
      console.error("mercadopago: valor divergente", { pedido: pedido.id, payment: pid });
      await deps.marcarSePendente(pedido.id, "recusado", pid);
      return { status: 200, body: { ok: true, creditado: false } };
    }
    await deps.creditar(pedido.id, pid, pg.payment_type_id);
    return { status: 200, body: { ok: true, creditado: true } };
  }
  if (pg.status === "rejected" || pg.status === "cancelled") {
    await deps.marcarSePendente(pedido.id, pg.status === "rejected" ? "recusado" : "cancelado", pid);
  } else if (pg.status === "refunded" || pg.status === "charged_back") {
    await deps.estornar(pedido.id, pg.status === "refunded" ? "pagamento devolvido" : "contestação do pagamento");
  }
  return { status: 200, body: { ok: true } };
}

/* ---------------- Presentation helpers ---------------- */
export const STATUS_PEDIDO: Record<string, string> = {
  pendente: "Aguardando pagamento", aprovado: "Aprovado", recusado: "Não aprovado",
  cancelado: "Cancelado", estornado: "Estornado", expirado: "Expirado",
};
export const brlCentavos = (c: number) => (c / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/** Gross/fee/net/margin for approved orders. metodo 'pix' → pix rate (bank_transfer too); else card rate. */
export function resumoReceita(pedidos: { valor_centavos: number; metodo: string | null }[], taxaPixPct: number, taxaCartaoPct: number, custoIaBrl: number) {
  let bruta = 0, taxa = 0;
  for (const p of pedidos) {
    const v = p.valor_centavos / 100;
    bruta += v;
    const pix = p.metodo === "pix" || p.metodo === "bank_transfer";
    taxa += v * ((pix ? taxaPixPct : taxaCartaoPct) / 100);
  }
  const liquida = bruta - taxa;
  const margem = liquida - custoIaBrl;
  return { bruta, taxa, liquida, custo_ia: custoIaBrl, margem, margem_pct: bruta > 0 ? (margem / bruta) * 100 : null, pedidos: pedidos.length };
}
