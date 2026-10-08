import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resumoFeedback, resumoFinanceiro, situacaoCredito } from "./admin-cobranca";

describe("Financeiro", () => {
  const jobs = [
    { id: "a", user_id: "u1", fonte: "creditos", roteiro: "reduzir_tempo", premium: false },
    { id: "b", user_id: "u1", fonte: "creditos", roteiro: "config_geral", premium: true },
    { id: "c", user_id: "u2", fonte: "teste", roteiro: "reduzir_tempo", premium: false },
    { id: "d", user_id: "adm", fonte: "admin", roteiro: "checklist", premium: false },
  ];
  const chamadas = [
    { job_id: "a", user_id: "u1", modelo: "s", custo_usd: 0.02 },
    { job_id: "a", user_id: "u1", modelo: "s", custo_usd: 0.02 },
    { job_id: "b", user_id: "u1", modelo: "o", custo_usd: 0.06 },
    { job_id: "c", user_id: "u2", modelo: "s", custo_usd: 0.01 },
    { job_id: "d", user_id: "adm", modelo: "s", custo_usd: 0.5 },
  ];
  const movimentos = [{ tipo: "reserva", quantidade: -1 }, { tipo: "reserva", quantidade: -2 }, { tipo: "estorno", quantidade: 0 }, { tipo: "entrada", quantidade: 10 }];
  const r = resumoFinanceiro({ chamadas, jobs, movimentos, cambio: 5 });

  it("separa cliente de administrador", () => {
    expect(r.cliente.analises).toBe(3);
    expect(r.cliente.custo_usd).toBeCloseTo(0.11);
    expect(r.admin.analises).toBe(1);
    expect(r.admin.custo_usd).toBeCloseTo(0.5);
  });
  it("custo por crédito = custo dos jobs de créditos em R$ ÷ créditos consumidos", () => {
    expect(r.creditos_consumidos).toBe(3);
    expect(r.custo_por_credito_brl).toBeCloseTo((0.1 * 5) / 3);
  });
  it("estorno reduz créditos consumidos", () => {
    const x = resumoFinanceiro({ chamadas, jobs, movimentos: [{ tipo: "reserva", quantidade: -2 }, { tipo: "estorno", quantidade: 2 }], cambio: 5 });
    expect(x.creditos_consumidos).toBe(0);
    expect(x.custo_por_credito_brl).toBeNull();
  });
});

describe("Feedback", () => {
  const rows = [
    { fez_sentido: "sim", imprimiu: "sim_boa", problemas: [], tempo_poupado: "ate_15" },
    { fez_sentido: "em_parte", imprimiu: "sim_problema", problemas: ["descolou", "suporte"], tempo_poupado: "nada" },
    { fez_sentido: "nao", imprimiu: "ainda_nao", problemas: [], tempo_poupado: "ate_15" },
    { fez_sentido: "sim", imprimiu: "sim_boa", problemas: [], tempo_poupado: "mais_60" },
  ];
  const f = resumoFeedback(rows);
  it("% fez sentido = sim + metade de em parte", () => {
    expect(f.sentido).toMatchObject({ sim: 2, em_parte: 1, nao: 1 });
    expect(f.sentido.pct).toBeCloseTo(62.5);
  });
  it("% deu certo = sim_boa ÷ (sim_boa + sim_problema)", () => {
    expect(f.impressao.pct).toBeCloseTo((2 / 3) * 100);
  });
  it("conta problemas e faixas de tempo", () => {
    expect(f.problemas["descolou"]).toBe(1);
    expect(f.tempo["ate_15"]).toBe(2);
  });
});

describe("Situação de crédito", () => {
  const agora = new Date("2026-10-08T15:00:00Z");
  it("teste mostra dia", () => {
    expect(situacaoCredito({ saldo: 0, cortesia: false, teste: { inicio: "2026-10-06T15:00:00Z", fim: "2026-10-20T15:00:00Z" } }, agora)).toBe("Teste · dia 3/14");
  });
  it("créditos e sem créditos", () => {
    expect(situacaoCredito({ saldo: 7, cortesia: false, teste: null }, agora)).toBe("7 créditos");
    expect(situacaoCredito({ saldo: 0, cortesia: false, teste: null }, agora)).toBe("Sem créditos");
    expect(situacaoCredito({ saldo: 0, cortesia: true, teste: null }, agora)).toBe("Cortesia");
  });
});

describe("Proteção de administrador (403)", () => {
  // Every server function in the admin modules must call guard() (assertAdmin → 403) before anything else.
  for (const file of ["src/lib/admin.functions.ts", "src/lib/admin-cobranca.functions.ts"]) {
    it(`todas as funções de ${file} checam admin primeiro`, () => {
      const code = readFileSync(file, "utf8");
      const handlers = code.split(".handler(").slice(1);
      expect(handlers.length).toBeGreaterThan(0);
      for (const h of handlers) {
        const corpo = h.slice(0, h.indexOf("\n", h.indexOf("{")) + 200);
        expect(corpo).toMatch(/await guard\(context\.userId\)/);
      }
    });
  }
});
