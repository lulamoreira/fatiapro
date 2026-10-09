import { describe, it, expect } from "vitest";
import { ERRO_VENDAS_PAUSADAS, MENSAGEM_VENDAS_PADRAO, exigirVendasAtivas, statusPublico } from "./vendas";

describe("criarCompra — portão de vendas", () => {
  it("recusa quando vendas_suspensas = true", () => {
    expect(() => exigirVendasAtivas([{ chave: "vendas_suspensas", valor: true }])).toThrow(ERRO_VENDAS_PAUSADAS);
  });
  it("funciona quando ativas ou sem configuração", () => {
    expect(() => exigirVendasAtivas([{ chave: "vendas_suspensas", valor: false }])).not.toThrow();
    expect(() => exigirVendasAtivas([])).not.toThrow();
  });
});

describe("statusVendas", () => {
  const linhas = [
    { chave: "vendas_suspensas", valor: true },
    { chave: "vendas_suspensas_mensagem", valor: "Volta segunda." },
    { chave: "cambio_brl", valor: 5.4 },
    { chave: "taxa_pix_pct", valor: 1 },
  ];
  it("não vaza outras chaves", () => {
    const r = statusPublico(linhas);
    expect(Object.keys(r).sort()).toEqual(["mensagem", "suspensas"]);
    expect(r).toEqual({ suspensas: true, mensagem: "Volta segunda." });
  });
  it("usa a mensagem padrão quando vazia", () => {
    expect(statusPublico([{ chave: "vendas_suspensas", valor: true }]).mensagem).toBe(MENSAGEM_VENDAS_PADRAO);
  });
  it("ativas: sem mensagem", () => {
    expect(statusPublico([])).toEqual({ suspensas: false, mensagem: null });
  });
});
