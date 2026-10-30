import { describe, expect, it } from "vitest";
import { progressoDaFase, testesDaFase, textoProgresso, type EventoProgresso } from "./progresso-analise";

const inicio = "2026-10-24T12:00:00Z";
const ev = (tipo: string, conteudo: unknown, segundo: number): EventoProgresso => ({
  tipo, conteudo, criado_em: new Date(Date.parse(inicio) + segundo * 1000).toISOString(),
});

describe("testesDaFase", () => {
  it("mescla campos por id em ordem cronológica e mantém os dados ao escolher", () => {
    const imagem = "data:image/png;base64,AAAA";
    const eventos = [
      ev("progresso", { teste: { id: "a", estado: "fatiando", titulo: "Original", grupo: "Posições", atual: true, imagem } }, 1),
      ev("progresso", { teste: { id: "a", estado: "pronto", segundos: 600, gramas: 30, suporte_g: 2 } }, 2),
      ev("progresso", { teste: { id: "a", estado: "escolhido" } }, 3),
    ];
    expect(testesDaFase([...eventos].reverse(), "analisando")).toEqual([
      { grupo: "Posições", testes: [{ id: "a", estado: "escolhido", titulo: "Original", grupo: "Posições", atual: true, imagem, segundos: 600, gramas: 30, suporte_g: 2 }] },
    ]);
  });
  it("ordena grupos e cartões pela primeira aparição, com Ajustes como padrão", () => {
    const eventos = [
      ev("progresso", { teste: { id: "b", estado: "pronto", grupo: "Suporte" } }, 1),
      ev("progresso", { teste: { id: "a", estado: "pronto" } }, 2),
      ev("progresso", { teste: { id: "c", estado: "fatiando", grupo: "Suporte" } }, 3),
      ev("progresso", { teste: { id: "b", estado: "escolhido" } }, 4),
    ];
    const grupos = testesDaFase(eventos, "analisando");
    expect(grupos.map((g) => g.grupo)).toEqual(["Suporte", "Ajustes"]);
    expect(grupos[0]?.testes.map((t) => t.id)).toEqual(["b", "c"]);
  });
  it("descarta testes anteriores ao último pedido de outra opção", () => {
    const eventos = [
      ev("progresso", { teste: { id: "velho", estado: "pronto" } }, 1),
      ev("pedido_outra", {}, 2),
      ev("progresso", { teste: { id: "meio", estado: "pronto" } }, 3),
      ev("pedido_outra", {}, 4),
      ev("progresso", { teste: { id: "novo", estado: "fatiando" } }, 5),
    ];
    expect(testesDaFase(eventos, "outra")[0]?.testes.map((t) => t.id)).toEqual(["novo"]);
  });
  it("aplicando usa o último marcador de aprovação", () => {
    const eventos = [
      ev("progresso", { teste: { id: "velho", estado: "pronto" } }, 1),
      ev("aprovacao", {}, 2),
      ev("progresso", { teste: { id: "novo", estado: "pronto" } }, 3),
    ];
    expect(testesDaFase(eventos, "aplicando")[0]?.testes.map((t) => t.id)).toEqual(["novo"]);
  });
  it("ignora imagens que não sejam PNG data URI e preserva imagem válida anterior", () => {
    const imagem = "data:image/png;base64,AAAA";
    const eventos = [
      ev("progresso", { teste: { id: "a", estado: "pronto", imagem: "https://example.com/a.png" } }, 1),
      ev("progresso", { teste: { id: "b", estado: "fatiando", imagem } }, 2),
      ev("progresso", { teste: { id: "b", estado: "pronto", imagem: "data:image/svg+xml;base64,AAAA" } }, 3),
    ];
    expect(testesDaFase(eventos, "analisando")[0]?.testes.map((t) => t.imagem)).toEqual([undefined, imagem]);
  });
  it("conteúdo inválido não quebra nem apaga medições válidas", () => {
    const eventos = [null, "texto", [], { teste: null }, { teste: [] }, { teste: { id: 1 } }, { teste: { id: "", estado: "pronto" } }]
      .map((conteudo, i) => ev("progresso", conteudo, i));
    expect(testesDaFase(eventos, "analisando")).toEqual([]);
    eventos.push(ev("progresso", { teste: { id: "a", estado: "pronto", gramas: 2 } }, 10));
    eventos.push(ev("progresso", { teste: { id: "a", estado: "inválido", gramas: NaN, segundos: -1, suporte_g: "2" } }, 11));
    expect(testesDaFase(eventos, "analisando")[0]?.testes).toEqual([{ id: "a", estado: "pronto", gramas: 2 }]);
  });
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