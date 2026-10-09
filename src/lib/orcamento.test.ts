import { describe, expect, it } from "vitest";
import { conteudoPdf, faixaDesconto, lerPrecos, nomeArquivoOrc, numeroOrc, totalCentavos } from "./orcamento";

describe("orçamento", () => {
  const descontos = [{ a_partir_de: 5, preco_unitario: 9 }, { a_partir_de: 10, preco_unitario: 8 }, { a_partir_de: 20, preco_unitario: 7 }];
  it("(a) escolhe a maior faixa com a_partir_de ≤ quantidade", () => {
    expect(faixaDesconto(descontos, 4)).toBeNull();
    expect(faixaDesconto(descontos, 12)?.preco_unitario).toBe(8);
    expect(faixaDesconto(descontos, 20)?.preco_unitario).toBe(7);
  });
  it("(b) lê preços de análise antiga pela tabela de texto", () => {
    const p = lerPrecos({ tabela: { colunas: ["Item", "Valor"], linhas: [["Custo de filamento", "R$ 3,10"], ["Preço mínimo", "R$ 12,34"], ["Preço justo", "R$ 1.234,50"], ["Preço premium", "R$ 20"], ["A partir de 10 unidades", "R$ 11,00"]] } });
    expect(p).toMatchObject({ minimo: 12.34, justo: 1234.5, premium: 20, custo_unitario: null });
    expect(p?.descontos).toEqual([{ a_partir_de: 10, preco_unitario: 11 }]);
    expect(lerPrecos({ tabela: { linhas: [["Outra coisa", "x"]] } })).toBeNull();
  });
  it("(c) total = quantidade × unitário", () => {
    expect(totalCentavos(3, 1999)).toBe(5997);
  });
  it("(d) o texto do PDF não contém custo, margem, mínimo nem o valor de custo", () => {
    const precos = lerPrecos({ precos: { quantidade: 2, custo_unitario: 4.37, minimo: 6, justo: 10, premium: 14, descontos: [] } })!;
    const t = conteudoPdf({ nome: "Ateliê São Paulo", documento: null, email: null, whatsapp: null, cidade: "São Paulo" },
      { numero: 1, criado_em: "2026-10-09T12:00:00Z", cliente_nome: "Ana", cliente_contato: null, descricao: "Vaso", quantidade: 2, preco_unitario_centavos: 1000, total_centavos: 2000, prazo_entrega: "5 dias úteis", validade_dias: 7, forma_pagamento: "Pix", observacoes: null });
    const txt = JSON.stringify(t).toLowerCase();
    for (const w of ["custo", "margem", "mínimo", "minimo"]) expect(txt).not.toContain(w);
    expect(txt).not.toContain("4,37");
    expect(precos.custo_unitario).toBe(4.37);
  });
  it("(e) número formatado ORC-0001", () => {
    expect(numeroOrc(1)).toBe("ORC-0001");
    expect(nomeArquivoOrc(12, "José Conceição")).toBe("ORC-0012-jose-conceicao.pdf");
  });
});
