import { describe, expect, it, vi } from "vitest";
import { createHmac } from "node:crypto";
import { ReembolsoErro, mensagemRecusa, reembolsarDuplicadoLogica, reembolsarPedidoLogica, ConferirErro, conferirPedidoLogica, type ConferirDeps, CompraInput, assinaturaValida, montarPreferencia, processarWebhook, resumoReceita, type WebhookDeps } from "./mercadopago";

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
    registrarDuplicado: vi.fn(async () => {}), exigirAssinatura: vi.fn(async () => false), eventoRecente: vi.fn(async () => false),
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
    expect(d.registrarEvento).toHaveBeenCalledWith(expect.objectContaining({ valido: false, motivo: "v1_diferente", origem: "webhook" }));
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
    expect(d.registrarEvento).toHaveBeenCalledWith(expect.objectContaining({ origem: "ipn" }));
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
    expect(d.marcarSePendente).toHaveBeenCalledWith(PED, "recusado", "123", null);
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
    const pref = montarPreferencia({ id: PED, nome: "50 créditos", creditos: 50, preco_centavos: 7990, validade_meses: 12 }, "p1", "a@b.c", new Date("2026-01-01T00:00:00Z"));
    expect(pref.items[0]!.unit_price).toBe(79.9);
    expect(pref.expiration_date_to).toBe("2026-01-01T02:00:00.000Z");
    expect(pref).not.toHaveProperty("notification_url");
  });
});

describe("montarPreferencia — dados do pagador e do item", () => {
  const pacote = { id: PED, nome: "50 créditos", creditos: 50, preco_centavos: 7990, validade_meses: 12 };
  const agora = new Date("2026-01-01T00:00:00Z");

  it("nome com duas ou mais palavras → name e surname separados no primeiro espaço", () => {
    const pref = montarPreferencia(pacote, "p1", "a@b.c", agora, "Ana Maria Souza");
    expect(pref.payer).toEqual({ email: "a@b.c", name: "Ana", surname: "Maria Souza" });
  });
  it("nome de uma palavra → só name, sem surname", () => {
    const pref = montarPreferencia(pacote, "p1", "a@b.c", agora, "Ana");
    expect(pref.payer).toEqual({ email: "a@b.c", name: "Ana" });
  });
  it("nome null e email null → preferência sem a chave payer", () => {
    const pref = montarPreferencia(pacote, "p1", null, agora, null);
    expect(pref).not.toHaveProperty("payer");
  });
  it("item com category_id e description de créditos; preferência com binary_mode e sem notification_url", () => {
    const pref = montarPreferencia(pacote, "p1", "a@b.c", agora, "Ana");
    expect(pref.items[0]!.category_id).toBe("services");
    expect(pref.items[0]!.description).toBe("Créditos para otimizar impressões 3D no FatiaPro (50 créditos, validade 12 meses)");
    expect(pref.binary_mode).toBe(true);
    expect(pref).not.toHaveProperty("notification_url");
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
      estornar: async () => {}, marcarSePendente: async () => {}, registrarDuplicado: async () => {},
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

describe("assinatura obrigatória (mp_exigir_assinatura)", () => {
  it("ligada + assinatura inválida → 401 e não consulta a API", async () => {
    const d = deps({});
    (d.exigirAssinatura as ReturnType<typeof vi.fn>).mockResolvedValue(true);
    const r = await processarWebhook(req("lixo"), d);
    expect(r.status).toBe(401);
    expect(d.buscarPagamento).not.toHaveBeenCalled();
    expect(d.creditar).not.toHaveBeenCalled();
  });
  it("ligada + assinatura válida → processa normalmente", async () => {
    const d = deps({});
    (d.exigirAssinatura as ReturnType<typeof vi.fn>).mockResolvedValue(true);
    const r = await processarWebhook(req(assinar("123", "r1", "100")), d);
    expect(r.status).toBe(200);
    expect(d.creditar).toHaveBeenCalledTimes(1);
  });
});

describe("dedupe de mp_eventos", () => {
  it("não grava de novo o mesmo (payment_id, motivo) dentro de 10 minutos", async () => {
    const d = deps({});
    const vistos = new Set<string>();
    (d.eventoRecente as ReturnType<typeof vi.fn>).mockImplementation(async (id: string, m: string) => vistos.has(`${id}|${m}`));
    d.registrarEvento.mockImplementation(async (e: { payment_id: string; motivo: string }) => { vistos.add(`${e.payment_id}|${e.motivo}`); });
    await processarWebhook(req("lixo"), d);
    await processarWebhook(req("lixo"), d);
    await processarWebhook(req("lixo"), d);
    expect(d.registrarEvento).toHaveBeenCalledTimes(1);
  });
});

describe("pagamento duplicado", () => {
  it("segundo pagamento aprovado no mesmo pedido vai para pagamentos_duplicados sem creditar", async () => {
    const d = deps({});
    d.buscarPagamento.mockResolvedValue({ id: 456, status: "approved", transaction_amount: 19.9, currency_id: "BRL", external_reference: PED, payment_type_id: "pix" });
    (d.buscarPedido as ReturnType<typeof vi.fn>).mockResolvedValue({ id: PED, status: "aprovado", valor_centavos: 1990, mp_payment_id: "123" });
    const r = await processarWebhook({ ...req(assinar("456", "r1", "100")), url: "https://x/w?data.id=456&type=payment" }, d);
    expect(r.body["resultado"]).toBe("duplicado");
    expect(d.creditar).not.toHaveBeenCalled();
    expect(d.registrarDuplicado).toHaveBeenCalledWith(PED, "456", 1990);
  });
  it("reembolso do pagamento duplicado não estorna os créditos do pedido", async () => {
    const d = deps({});
    d.buscarPagamento.mockResolvedValue({ id: 456, status: "refunded", transaction_amount: 19.9, currency_id: "BRL", external_reference: PED, payment_type_id: "pix" });
    (d.buscarPedido as ReturnType<typeof vi.fn>).mockResolvedValue({ id: PED, status: "aprovado", valor_centavos: 1990, mp_payment_id: "123" });
    await processarWebhook({ ...req("x"), url: "https://x/w?data.id=456&type=payment" }, d);
    expect(d.estornar).not.toHaveBeenCalled();
  });
});

describe("reembolso pelo admin", () => {
  it("chama a API com idempotency key refund-<pedido> e estorna uma vez", async () => {
    const reembolsarMP = vi.fn(async () => ({ ok: true as const }));
    const estornar = vi.fn(async () => {});
    await reembolsarPedidoLogica({ id: PED, status: "aprovado", mp_payment_id: "123" }, { reembolsarMP, estornar });
    expect(reembolsarMP).toHaveBeenCalledWith("123", `refund-${PED}`);
    expect(estornar).toHaveBeenCalledTimes(1);
    expect(estornar).toHaveBeenCalledWith(PED, "reembolso pelo admin");
  });
  it("Mercado Pago recusou → erro claro e não estorna", async () => {
    const estornar = vi.fn(async () => {});
    await expect(reembolsarPedidoLogica({ id: PED, status: "aprovado", mp_payment_id: "123" }, { reembolsarMP: async () => ({ ok: false, mensagem: "O Mercado Pago recusou o reembolso (400)." }), estornar }))
      .rejects.toThrow("O Mercado Pago recusou o reembolso (400).");
    expect(estornar).not.toHaveBeenCalled();
  });
  it("pedido não aprovado → recusa", async () => {
    await expect(reembolsarPedidoLogica({ id: PED, status: "pendente", mp_payment_id: null }, { reembolsarMP: vi.fn(), estornar: vi.fn() })).rejects.toBeInstanceOf(ReembolsoErro);
  });
  it("duplicado: reembolsa sem estornar créditos", async () => {
    const reembolsarMP = vi.fn(async () => ({ ok: true as const }));
    await reembolsarDuplicadoLogica({ payment_id: "456", reembolsado_em: null }, { reembolsarMP });
    expect(reembolsarMP).toHaveBeenCalledWith("456", "refund-dup-456");
  });
});

describe("mensagem de recusa", () => {
  it.each([
    ["cc_rejected_insufficient_amount", "Saldo ou limite insuficiente"],
    ["cc_rejected_bad_filled_security_code", "Código de segurança incorreto"],
    ["cc_rejected_bad_filled_date", "Validade incorreta"],
    ["cc_rejected_bad_filled_other", "Confira os dados do cartão"],
    ["cc_rejected_call_for_authorize", "Seu banco pediu autorização — ligue para o banco e tente de novo"],
    ["cc_rejected_high_risk", "Pagamento recusado por segurança — tente outro meio (Pix)"],
    ["cc_rejected_blacklist", "Pagamento recusado por segurança — tente outro meio (Pix)"],
    ["cc_rejected_duplicated_payment", "Pagamento duplicado — confira seu extrato"],
    ["cc_rejected_max_attempts", "Muitas tentativas — use outro cartão ou Pix"],
    ["qualquer_outro", "Pagamento não aprovado — tente outro meio de pagamento"],
    [null, "Pagamento não aprovado — tente outro meio de pagamento"],
  ])("%s", (det, msg) => expect(mensagemRecusa(det)).toBe(msg));
});
