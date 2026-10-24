import { describe, expect, it } from "vitest";
import { progressoDaFase, textoProgresso, type EventoProgresso } from "./progresso-analise";

const inicio = "2026-10-24T12:00:00Z";
const ev = (tipo: string, conteudo: unknown, segundo: number): EventoProgresso => ({
  tipo, conteudo, criado_em: new Date(Date.parse(inicio) + segundo * 1000).toISOString(),
});

describe("progresso da análise", () => {
  it("percentual sozinho não entra na linha do tempo nem substitui a última mensagem", () => {
    const eventos = [ev("progresso", { texto: "Fatiando" }, 1), ev("progresso", { percentual: 33 }, 2), ev("progresso", { texto: "  " }, 3)];
    const r = progressoDaFase(eventos, "analisando", inicio);
    expect(r.mensagens).toEqual([eventos[0]]);
    expect(r.mensagens.map(textoProgresso)).toEqual(["Fatiando"]);
    expect(r.percentual).toBe(33);
  });
  it("outra opção ignora os percentuais da análise anterior", () => {
    const eventos = [ev("progresso", { percentual: 90 }, 1), ev("pedido_outra", {}, 2)];
    expect(progressoDaFase(eventos, "outra", inicio).percentual).toBeNull();
    eventos.push(ev("progresso", { percentual: 12 }, 3));
    expect(progressoDaFase(eventos, "analisando", inicio).percentual).toBe(12);
  });
  it("aplicação lê apenas desde a última aprovação e pega o último percentual", () => {
    const eventos = [ev("progresso", { percentual: 100 }, 1), ev("aprovacao", {}, 2), ev("progresso", { percentual: 30 }, 3), ev("progresso", { percentual: 27 }, 4)];
    expect(progressoDaFase(eventos, "aplicando", inicio).percentual).toBe(27);
  });
  it("fase otimista não reutiliza percentuais anteriores e valores inválidos são ignorados", () => {
    const eventos = [ev("progresso", { percentual: 99 }, 1), ev("progresso", { percentual: 101 }, 3), ev("progresso", { percentual: "30" }, 4)];
    expect(progressoDaFase(eventos, "aplicando", inicio, Date.parse(inicio) + 2000).percentual).toBeNull();
    expect(progressoDaFase(eventos, "na_fila", inicio).percentual).toBeNull();
  });
});