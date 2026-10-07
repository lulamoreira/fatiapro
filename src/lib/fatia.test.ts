import { describe, it, expect } from "vitest";
import { custoApiUSD, formatDuracao, formatGramas, isConectado, marcasPara, togglePrioridade, usoPlano } from "./fatia";

describe("formatDuracao", () => {
  it("menos de 1h mostra minutos e segundos", () => expect(formatDuracao(1941)).toBe("32m 21s"));
  it("1h ou mais mostra horas e minutos", () => expect(formatDuracao(3900)).toBe("1h 05m"));
});

describe("formatGramas", () => {
  it("uma casa decimal", () => expect(formatGramas(12.345)).toBe("12,3 g"));
});

describe("custo estimado API", () => {
  it("(tokens_in × preço_in + tokens_out × preço_out) / 1.000.000", () => {
    expect(custoApiUSD({ tokens_entrada_tipicos: 60000, tokens_saida_tipicos: 6000 }, { preco_entrada_usd_por_milhao: 3, preco_saida_usd_por_milhao: 15 })).toBeCloseTo(0.27);
  });
});

describe("uso do plano", () => {
  it("leve abaixo de 25.000", () => expect(usoPlano(20000)).toBe("leve"));
  it("médio até 60.000", () => expect(usoPlano(60000)).toBe("médio"));
  it("pesado acima de 60.000", () => expect(usoPlano(60001)).toBe("pesado"));
});

describe("prioridade ranqueada", () => {
  it("3º clique remove o mais antigo", () => expect(togglePrioridade(["Tempo", "Acabamento"], "Resistência")).toEqual(["Acabamento", "Resistência"]));
});

describe("marcas", () => {
  it("Genérica primeiro e Outra… por último", () => {
    const m = marcasPara({ id: "bambu", versao: null, impressoras: [], filamentos: { PLA: { "Bambu Lab": ["PLA Basic"] } } }, "PLA");
    expect(m).toEqual(["Genérica", "Bambu Lab", "Outra…"]);
  });
});

describe("conectado", () => {
  it("menos de 60 s é conectado", () => {
    const now = Date.parse("2026-01-01T00:01:00Z");
    expect(isConectado("2026-01-01T00:00:30Z", now)).toBe(true);
    expect(isConectado("2026-01-01T00:00:00Z", now)).toBe(false);
  });
});
