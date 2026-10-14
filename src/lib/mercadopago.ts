/**
 * Mercado Pago (Checkout Pro) — pure logic, dependencies injected so it is testable.
 * Rules: price/credits come only from the database; credits are released only after
 * the server QUERIES the payment on the Mercado Pago API (never trusts the notification body).
 */
import { z } from "zod";

export const SITE = "https://fatiapro.lovable.app";

/** Browser input for criarCompra: only the package id. Any extra field (price!) is dropped. */
export const CompraInput = z.object({ pacote_id: z.string().uuid() }).strip();

export interface PacoteRow { id: string; nome: string; creditos: number; preco_centavos: number; validade_meses: number }

/** Splits at the first space: name = first word, surname = the rest; each capped at 60 chars. */
export function montarPreferencia(p: PacoteRow, pedidoId: string, email: string | null, agora: Date, nome: string | null = null) {
  const volta = `${SITE}/app/plano?pedido=${pedidoId}`;
  const payer: Record<string, string> = {};
  if (email) payer["email"] = email;
  const texto = (nome ?? "").trim();
  if (texto) {
    const espaco = texto.indexOf(" ");
    const first = espaco === -1 ? texto : texto.slice(0, espaco);
    const last = espaco === -1 ? "" : texto.slice(espaco + 1).trim();
    payer["name"] = first.slice(0, 60);
    if (last) payer["surname"] = last.slice(0, 60);
  }
  return {
    items: [{
      id: p.id,
      title: `FatiaPro — ${p.nome}`,
      description: `Créditos para otimizar impressões 3D no FatiaPro (${p.creditos} créditos, validade ${p.validade_meses} meses)`,
      category_id: "services",
      quantity: 1,
      unit_price: p.preco_centavos / 100,
      currency_id: "BRL",
    }],
    external_reference: pedidoId,
    ...(Object.keys(payer).length > 0 ? { payer } : {}),
    back_urls: { success: volta, failure: volta, pending: volta },
    auto_return: "approved",
    binary_mode: true,
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

export type MotivoAssinatura = "ok" | "sem_cabecalho" | "formato" | "v1_diferente";

/** x-signature "ts=...,v1=..."; manifest `id:<data.id>;request-id:<x-request-id>;ts:<ts>;`; HMAC-SHA256 hex. */
export async function verificarAssinatura(xSignature: string | null, xRequestId: string | null, dataId: string | null, secret: string): Promise<MotivoAssinatura> {
  if (!xSignature || !xRequestId || !dataId || !secret) return "sem_cabecalho";
  const partes = Object.fromEntries(xSignature.split(",").map((p) => p.trim().split("=", 2) as [string, string]));
  const ts = partes["ts"], v1 = partes["v1"];
  if (!ts || !v1 || !/^[0-9a-f]{64}$/i.test(v1)) return "formato";
  const manifesto = `id:${normalizarDataId(dataId)};request-id:${xRequestId};ts:${ts};`;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = hex(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(manifesto)));
  return iguais(mac, v1.toLowerCase()) ? "ok" : "v1_diferente";
}

export async function assinaturaValida(xSignature: string | null, xRequestId: string | null, dataId: string | null, secret: string): Promise<boolean> {
  return (await verificarAssinatura(xSignature, xRequestId, dataId, secret)) === "ok";
}

/* ---------------- Payment processing ---------------- */
export interface Pagamento { id: string | number; status: string; transaction_amount: number; currency_id: string; external_reference: string | null; payment_type_id: string | null; status_detail?: string | null }
export interface PedidoRow { id: string; status: string; valor_centavos: number; mp_payment_id?: string | null }

export interface PagamentoDeps {
  buscarPagamento(id: string): Promise<Pagamento | null>;
  buscarPedido(id: string): Promise<PedidoRow | null>;
  creditar(pedidoId: string, paymentId: string, metodo: string | null): Promise<void>;
  estornar(pedidoId: string, motivo: string): Promise<void>;
  /** Changes status only while the order is still 'pendente'. */
  marcarSePendente(pedidoId: string, status: "recusado" | "cancelado", paymentId: string, detalhe: string | null): Promise<void>;
  /** A second approved payment for an order already approved with another payment. */
  registrarDuplicado(pedidoId: string, paymentId: string, valorCentavos: number): Promise<void>;
}

export type ResultadoPagamento = "creditado" | "valor_divergente" | "recusado" | "estornado" | "duplicado" | "ignorado";

/**
 * Queries the payment on the Mercado Pago API (our token) and acts only on that answer.
 * A forged notification cannot create an approved payment in our account.
 */
export async function processarPagamento(paymentId: string, deps: PagamentoDeps, pg?: Pagamento | null): Promise<ResultadoPagamento> {
  const p = pg !== undefined ? pg : await deps.buscarPagamento(paymentId);
  if (!p || !p.external_reference) return "ignorado";
  const pedido = await deps.buscarPedido(p.external_reference);
  if (!pedido) return "ignorado";
  const pid = String(p.id);
  const outroPagamento = !!pedido.mp_payment_id && pedido.mp_payment_id !== pid;
  const detalhe = typeof p.status_detail === "string" ? p.status_detail.slice(0, 80) : null;
  if (p.status === "approved" && pedido.status === "aprovado" && outroPagamento) {
    // Paid twice: never credit again; admin refunds it from the Pedidos tab.
    await deps.registrarDuplicado(pedido.id, pid, Math.round(Number(p.transaction_amount) * 100));
    return "duplicado";
  }
  if (p.status === "approved") {
    if (Math.round(Number(p.transaction_amount) * 100) !== pedido.valor_centavos || p.currency_id !== "BRL") {
      console.error("mercadopago: valor divergente", { pedido: pedido.id, payment: pid });
      await deps.marcarSePendente(pedido.id, "recusado", pid, detalhe);
      return "valor_divergente";
    }
    await deps.creditar(pedido.id, pid, p.payment_type_id);
    return "creditado";
  }
  if (p.status === "rejected" || p.status === "cancelled") {
    await deps.marcarSePendente(pedido.id, p.status === "rejected" ? "recusado" : "cancelado", pid, detalhe);
    return "recusado";
  }
  if (p.status === "refunded" || p.status === "charged_back") {
    // A refunded duplicate payment must not take back the credits of the real one.
    if (outroPagamento) return "ignorado";
    await deps.estornar(pedido.id, p.status === "refunded" ? "pagamento devolvido" : "contestação do pagamento");
    return "estornado";
  }
  return "ignorado";
}

export interface WebhookDeps extends PagamentoDeps {
  secret: string;
  registrarEvento(e: { payment_id: string | null; status: string | null; valido: boolean; motivo: MotivoAssinatura; origem: OrigemAviso }): Promise<void>;
  /** config_app.mp_exigir_assinatura */
  exigirAssinatura(): Promise<boolean>;
  /** True when a row with the same (payment_id, motivo) was saved in the last 10 minutes. */
  eventoRecente(paymentId: string | null, motivo: MotivoAssinatura): Promise<boolean>;
}

export const DEDUPE_EVENTOS_MS = 10 * 60_000;

export type OrigemAviso = "webhook" | "ipn" | null;

/** ?data.id=&type= → webhook; ?id=&topic= → ipn (old format). */
export function origemAviso(u: URL): OrigemAviso {
  if (u.searchParams.has("data.id") || u.searchParams.has("type")) return "webhook";
  if (u.searchParams.has("topic") || u.searchParams.has("id")) return "ipn";
  return null;
}

export interface WebhookReq { url: string; headers: { get(n: string): string | null }; corpo: unknown }

/**
 * Signature is always checked and logged. With mp_exigir_assinatura on, an invalid one gets 401
 * and the API is NOT queried; otherwise credit depends only on the API answer.
 * At most one mp_eventos row per (payment_id, motivo) every 10 minutes.
 */
export async function processarWebhook(req: WebhookReq, deps: WebhookDeps): Promise<{ status: number; body: Record<string, unknown> }> {
  const u = new URL(req.url);
  const dataId = u.searchParams.get("data.id") ?? u.searchParams.get("id");
  const corpo = (req.corpo && typeof req.corpo === "object" ? req.corpo : {}) as Record<string, unknown>;
  const tipo = u.searchParams.get("type") ?? u.searchParams.get("topic") ?? (typeof corpo["type"] === "string" ? corpo["type"] : null);
  const motivo = await verificarAssinatura(req.headers.get("x-signature"), req.headers.get("x-request-id"), dataId, deps.secret);
  const valido = motivo === "ok";
  const origem = origemAviso(u);
  const registrar = async (e: Parameters<WebhookDeps["registrarEvento"]>[0]) => {
    try { if (!(await deps.eventoRecente(e.payment_id, e.motivo))) await deps.registrarEvento(e); } catch { /* log only */ }
  };
  if (!valido && (await deps.exigirAssinatura().catch(() => false))) {
    await registrar({ payment_id: dataId?.slice(0, 64) ?? null, status: "assinatura_recusada", valido, motivo, origem });
    return { status: 401, body: { erro: "assinatura_invalida" } };
  }
  if (tipo !== "payment" || !dataId || !/^\d{1,30}$/.test(dataId)) {
    await registrar({ payment_id: dataId?.slice(0, 64) ?? null, status: tipo?.slice(0, 40) ?? null, valido, motivo, origem });
    return { status: 200, body: { ok: true, ignorado: true } };
  }
  const pg = await deps.buscarPagamento(dataId);
  await registrar({ payment_id: dataId, status: pg?.status ?? "nao_encontrado", valido, motivo, origem });
  const r = await processarPagamento(dataId, deps, pg);
  return { status: 200, body: { ok: true, resultado: r } };
}

/* ---------------- conferirPedido ---------------- */
export interface ConferirDeps extends PagamentoDeps {
  donoDoPedido(pedidoId: string): Promise<string | null>;
  ehAdmin(userId: string): Promise<boolean>;
  /** Atomically claims the 5 s slot; false if checked less than 5 s ago. */
  reservarConferencia(pedidoId: string): Promise<boolean>;
  pagamentosDoPedido(pedidoId: string): Promise<Pagamento[]>;
  statusPedido(pedidoId: string): Promise<string>;
}

export class ConferirErro extends Error {}

export async function conferirPedidoLogica(pedidoId: string, userId: string, deps: ConferirDeps): Promise<{ status: string; conferido: boolean }> {
  const dono = await deps.donoDoPedido(pedidoId);
  if (!dono || (dono !== userId && !(await deps.ehAdmin(userId)))) throw new ConferirErro("Pedido não encontrado.");
  if (!(await deps.reservarConferencia(pedidoId))) return { status: await deps.statusPedido(pedidoId), conferido: false };
  const pagamentos = (await deps.pagamentosDoPedido(pedidoId)).slice(0, 5);
  for (const pg of pagamentos) {
    if (pg.external_reference !== pedidoId) continue;
    await processarPagamento(String(pg.id), deps, pg);
  }
  return { status: await deps.statusPedido(pedidoId), conferido: true };
}

/* ---------------- Reembolso (admin) ---------------- */
export interface ReembolsoDeps {
  /** POST /v1/payments/{id}/refunds with X-Idempotency-Key. */
  reembolsarMP(paymentId: string, chave: string): Promise<{ ok: true } | { ok: false; mensagem: string }>;
  estornar(pedidoId: string, motivo: string): Promise<void>;
}
export class ReembolsoErro extends Error {}
export const chaveReembolso = (pedidoId: string) => `refund-${pedidoId}`;
export const chaveReembolsoDuplicado = (paymentId: string) => `refund-dup-${paymentId}`;

/** Refunds an approved order on Mercado Pago, then removes what is left of its credits (once). */
export async function reembolsarPedidoLogica(p: { id: string; status: string; mp_payment_id: string | null }, deps: ReembolsoDeps): Promise<void> {
  if (p.status !== "aprovado" || !p.mp_payment_id) throw new ReembolsoErro("Só pedidos aprovados podem ser reembolsados.");
  const r = await deps.reembolsarMP(p.mp_payment_id, chaveReembolso(p.id));
  if (!r.ok) throw new ReembolsoErro(r.mensagem);
  await deps.estornar(p.id, "reembolso pelo admin");
}

/** Refunds a duplicate payment only (credits are untouched). */
export async function reembolsarDuplicadoLogica(d: { payment_id: string; reembolsado_em: string | null }, deps: Pick<ReembolsoDeps, "reembolsarMP">): Promise<void> {
  if (d.reembolsado_em) throw new ReembolsoErro("Este pagamento já foi reembolsado.");
  const r = await deps.reembolsarMP(d.payment_id, chaveReembolsoDuplicado(d.payment_id));
  if (!r.ok) throw new ReembolsoErro(r.mensagem);
}

/** Friendly text for the Mercado Pago refusal message. */
export function mensagemErroReembolso(status: number, corpo: unknown): string {
  const m = corpo && typeof corpo === "object" && typeof (corpo as { message?: unknown }).message === "string" ? (corpo as { message: string }).message : "";
  return `O Mercado Pago recusou o reembolso (${status})${m ? `: ${m.slice(0, 200)}` : ""}.`;
}

/* ---------------- Recusa ---------------- */
export const MOTIVO_RECUSA: Record<string, string> = {
  cc_rejected_insufficient_amount: "Saldo ou limite insuficiente",
  cc_rejected_bad_filled_security_code: "Código de segurança incorreto",
  cc_rejected_bad_filled_date: "Validade incorreta",
  cc_rejected_bad_filled_other: "Confira os dados do cartão",
  cc_rejected_call_for_authorize: "Seu banco pediu autorização — ligue para o banco e tente de novo",
  cc_rejected_high_risk: "Pagamento recusado por segurança — tente outro meio (Pix)",
  cc_rejected_blacklist: "Pagamento recusado por segurança — tente outro meio (Pix)",
  cc_rejected_duplicated_payment: "Pagamento duplicado — confira seu extrato",
  cc_rejected_max_attempts: "Muitas tentativas — use outro cartão ou Pix",
};
export const RECUSA_PADRAO = "Pagamento não aprovado — tente outro meio de pagamento";
export const mensagemRecusa = (detalhe: string | null | undefined) => (detalhe && MOTIVO_RECUSA[detalhe]) || RECUSA_PADRAO;

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
