import { describe, it, expect } from "vitest";
import { nomeArquivoOtimizado, custoApiUSD, formatDuracao, formatGramas, isConectado, marcasPara, togglePrioridade, usoPlano } from "./fatia";

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
    const m = marcasPara({ nome: null, adicionado_manual: false, id: "bambu", versao: null, impressoras: [], filamentos: { PLA: { "Bambu Lab": ["PLA Basic"] } } }, "PLA");
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

describe("nome do arquivo otimizado", () => {
  it("segue o exemplo da regra", () => {
    expect(nomeArquivoOtimizado({ peca: "热床线辅助定位.stl", impressora: "Anycubic Kobra X 0.4 nozzle", bico: "0.4", marca: "Anycubic", linha: "Anycubic PLA", data: new Date(2026, 9, 7, 17, 21) }))
      .toBe("热床线辅助定位_Anycubic-Kobra-X_0.4mm_Anycubic-PLA_2026-10-07_17h21.3mf");
  });
  it("Genérica + PLA vira Generico-PLA e sem arquivo vira peca-aberta", () => {
    expect(nomeArquivoOtimizado({ peca: null, impressora: "X1C", bico: "0.4", marca: "Genérica", linha: "PLA", data: new Date(2026, 0, 2, 3, 4) }))
      .toBe("peca-aberta_X1C_0.4mm_Generico-PLA_2026-01-02_03h04.3mf");
  });
});

import { fatiadorLabel as _fl, nomeArquivoCompleto as _nc, parseRelatorio as _pr } from "./fatia";
describe("fatiadores vindos do relatório", () => {
  it("aceita ids novos e usa o nome do relatório", () => {
    const rel = _pr({ fatiadores: [{ id: "creality_print", nome: "Creality Print", adicionado_manual: true }, { id: "X Inválido" }] });
    expect(rel.fatiadores.map((f) => f.id)).toEqual(["creality_print"]);
    expect(_fl("creality_print", rel)).toBe("Creality Print");
    expect(_fl("bambu")).toBe("Bambu Studio");
  });
  it("prévia do nome só fica completa com peça, impressora e filamento", () => {
    expect(_nc({ pecaDefinida: false, impressora: "X1C", marca: "Bambu", linha: "PLA" })).toBe(false);
    expect(_nc({ pecaDefinida: true, impressora: "X1C", marca: "Bambu", linha: "PLA" })).toBe(true);
  });
});
