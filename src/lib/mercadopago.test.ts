import { describe, expect, it, vi } from "vitest";
import { createHmac } from "node:crypto";
import { ConferirErro, conferirPedidoLogica, type ConferirDeps, CompraInput, assinaturaValida, montarPreferencia, processarWebhook, resumoReceita, type WebhookDeps } from "./mercadopago";

const SECRET = "segredo-teste";
const PED = "11111111-1111-4111-8111-111111111111";
const assinar = (id: string, rid: string, ts: string, secret = SECRET) =>
  `ts=${ts},v1=${createHmac("sha256", secret).update(`id:${id};request-id:${rid};ts:${ts};`).digest("hex")}`;

describe("assinatura do webhook", () => {
  it("válida passa", async () => { expect(await assinaturaValida(assinar("123", "r1", "100"), "r1", "123", SECRET)).toBe(true); });
  it("data.id com letras é comparado em minúsculas", async () => { expect(await assinaturaValida(assinar("abc", "r1", "100"), "r1", "ABC", SECRET)).toBe(true); });
  it("v1 errado → inválida", async () => { expect(await assinaturaValida("ts=100,v1=" + "0".repeat(64), "r1", "123", SECRET)).toBe(false); });
  it("ts alterado → inválida", async () => { expect(await assinaturaValida(assinar("123", "r1", "100").replace("ts=100", "ts=101"), "r1", "123", SECRET)).toBe(false); });
  it("request-id diferente → inválida", async () => { expect(await assinaturaValida(assinar("123", "r1", "100"), "r2", "123", SECRET)).toBe(false); });
});

function deps(pg: Partial<{ status: string; transaction_amount: number; currency_id: string }>): WebhookDeps & { creditar: ReturnType<typeof vi.fn>; marcarSePendente: ReturnType<typeof vi.fn>; buscarPagamento: ReturnType<typeof vi.fn>; registrarEvento: ReturnType<typeof vi.fn> } {
  return {
    secret: SECRET,
    buscarPagamento: vi.fn(async () => ({ id: 123, status: "approved", transaction_amount: 19.9, currency_id: "BRL", external_reference: PED, payment_type_id: "pix", ...pg })),
    buscarPedido: vi.fn(async () => ({ id: PED, status: "pendente", valor_centavos: 1990 })),
    creditar: vi.fn(async () => {}), estornar: vi.fn(async () => {}), marcarSePendente: vi.fn(async () => {}), registrarEvento: vi.fn(async () => {}),
  } as never;
}
const req = (sig: string, rid = "r1") => ({
  url: "https://x/api/public/mercadopago/webhook?data.id=123&type=payment",
  headers: new Headers({ "x-signature": sig, "x-request-id": rid }),
  corpo: { data: { id: "999" }, action: "payment.updated", status: "approved" },
});

describe("processarWebhook", () => {
  it("assinatura inválida + pagamento aprovado na API → credita uma vez e registra o motivo", async () => {
    const d = deps({});
    const r = await processarWebhook(req(assinar("123", "r1", "100"), "outro"), d);
    expect(r.status).toBe(200);
    expect(d.creditar).toHaveBeenCalledTimes(1);
    expect(d.registrarEvento).toHaveBeenCalledWith(expect.objectContaining({ valido: false, motivo: "v1_diferente" }));
  });
  it("assinatura inválida + pagamento que a API não encontra → não credita", async () => {
    const d = deps({});
    d.buscarPagamento.mockResolvedValueOnce(null);
    const r = await processarWebhook(req("lixo", "r1"), d);
    expect(r.status).toBe(200);
    expect(d.creditar).not.toHaveBeenCalled();
  });
  it("formato antigo ?id=&topic=payment é aceito; merchant_order é ignorado", async () => {
    const d = deps({});
    await processarWebhook({ url: "https://x/w?id=123&topic=payment", headers: new Headers(), corpo: null }, d);
    expect(d.creditar).toHaveBeenCalledTimes(1);
    const d2 = deps({});
    const r = await processarWebhook({ url: "https://x/w?id=55&topic=merchant_order", headers: new Headers(), corpo: null }, d2);
    expect(r.status).toBe(200);
    expect(d2.buscarPagamento).not.toHaveBeenCalled();
  });
  it("aprovado com valor certo → credita usando o id consultado na API", async () => {
    const d = deps({});
    const r = await processarWebhook(req(assinar("123", "r1", "100")), d);
    expect(r.status).toBe(200);
    expect(d.buscarPagamento).toHaveBeenCalledWith("123");
    expect(d.creditar).toHaveBeenCalledWith(PED, "123", "pix");
  });
  it("valor pago diferente do pedido → não credita e marca recusado", async () => {
    const d = deps({ transaction_amount: 1 });
    const r = await processarWebhook(req(assinar("123", "r1", "100")), d);
    expect(r.status).toBe(200);
    expect(d.creditar).not.toHaveBeenCalled();
    expect(d.marcarSePendente).toHaveBeenCalledWith(PED, "recusado", "123");
  });
  it("moeda diferente de BRL → não credita", async () => {
    const d = deps({ currency_id: "USD" });
    await processarWebhook(req(assinar("123", "r1", "100")), d);
    expect(d.creditar).not.toHaveBeenCalled();
  });
});

describe("criarCompra", () => {
  it("ignora qualquer preço vindo do navegador", () => {
    const entrada = CompraInput.parse({ pacote_id: PED, preco_centavos: 1, creditos: 9999, unit_price: 0.01 });
    expect(entrada).toEqual({ pacote_id: PED });
    const pref = montarPreferencia({ id: PED, nome: "50 créditos", creditos: 50, preco_centavos: 7990 }, "p1", "a@b.c", new Date("2026-01-01T00:00:00Z"));
    expect(pref.items[0]!.unit_price).toBe(79.9);
    expect(pref.expiration_date_to).toBe("2026-01-01T02:00:00.000Z");
  });
});

describe("resumoReceita", () => {
  it("taxa 1% no pix e 5% no cartão", () => {
    const r = resumoReceita([{ valor_centavos: 10000, metodo: "pix" }, { valor_centavos: 10000, metodo: "credit_card" }], 1, 5, 20);
    expect(r.bruta).toBe(200);
    expect(r.taxa).toBeCloseTo(6);
    expect(r.margem).toBeCloseTo(174);
  });
});

describe("conferirPedido", () => {
  /** Fake DB mirroring creditar_pedido idempotency (one batch per order). */
  function fake(dono: string) {
    const lotes = new Set<string>();
    let status = "pendente";
    let ultima = 0;
    const d: ConferirDeps = {
      buscarPagamento: async () => null,
      buscarPedido: async () => ({ id: PED, status, valor_centavos: 1990 }),
      creditar: async (id) => { if (status !== "aprovado") { lotes.add(id + ":" + lotes.size); status = "aprovado"; } },
      estornar: async () => {}, marcarSePendente: async () => {},
      donoDoPedido: async () => dono,
      ehAdmin: async () => false,
      reservarConferencia: async () => { const ok = Date.now() - ultima >= 5000; if (ok) ultima = Date.now(); return ok; },
      pagamentosDoPedido: async () => [{ id: 9, status: "approved", transaction_amount: 19.9, currency_id: "BRL", external_reference: PED, payment_type_id: "pix" }],
      statusPedido: async () => status,
    };
    return { d, lotes, reset: () => { ultima = 0; } };
  }
  it("pedido de outro usuário → recusado", async () => {
    const { d } = fake("dono");
    await expect(conferirPedidoLogica(PED, "intruso", d)).rejects.toBeInstanceOf(ConferirErro);
  });
  it("conferir repetido → um único lote", async () => {
    const f = fake("u1");
    expect((await conferirPedidoLogica(PED, "u1", f.d)).status).toBe("aprovado");
    f.reset();
    await conferirPedidoLogica(PED, "u1", f.d);
    expect(f.lotes.size).toBe(1);
  });
  it("menos de 5 s depois → não consulta de novo", async () => {
    const f = fake("u1");
    const spy = vi.spyOn(f.d, "pagamentosDoPedido");
    await conferirPedidoLogica(PED, "u1", f.d);
    const r = await conferirPedidoLogica(PED, "u1", f.d);
    expect(r.conferido).toBe(false);
    expect(spy).toHaveBeenCalledTimes(1);
  });
});
