import { describe, it, expect } from "vitest";
import { sanitizarNomePeca, nomeParaGravar, extrairNomeDoEvento, nomePecaExibicao } from "./nome-peca";

describe("nome da peça vindo da ponte", () => {
  it("grava quando o job está sem nome", () => {
    expect(nomeParaGravar(null, "minha-peca.3mf")).toBe("minha-peca.3mf");
  });
  it("não sobrescreve nome existente", () => {
    expect(nomeParaGravar("enviada.stl", "outra.3mf")).toBeNull();
  });
  it("remove pastas do caminho (/ e \\)", () => {
    expect(sanitizarNomePeca("C:\\Users\\Lula\\Peças\\suporte.3mf")).toBe("suporte.3mf");
    expect(sanitizarNomePeca("/home/lula/projetos/caixa.3mf")).toBe("caixa.3mf");
  });
  it("tira caracteres de controle e espaços", () => {
    expect(sanitizarNomePeca("  pe\u0000ça\n.3mf ")).toBe("peça.3mf");
  });
  it("ignora valores inválidos", () => {
    expect(nomeParaGravar(null, 123)).toBeNull();
    expect(nomeParaGravar(null, "   ")).toBeNull();
    expect(nomeParaGravar(null, "pasta/")).toBeNull();
    expect(nomeParaGravar(null, "a".repeat(201))).toBeNull();
    expect(nomeParaGravar(null, undefined)).toBeNull();
  });
  it("aceita 200 caracteres", () => {
    expect(sanitizarNomePeca("a".repeat(200))).toHaveLength(200);
  });
});

describe("extração do nome a partir do evento", () => {
  const ev = (n: string) => `Usando a peça aberta no Bambu Studio: ${n} (versão das 15:42:10)`;
  it("nome com espaço", () => expect(extrairNomeDoEvento(ev("suporte de celular"))).toBe("suporte de celular"));
  it("nome com acento", () => expect(extrairNomeDoEvento(ev("Peça da Ação"))).toBe("Peça da Ação"));
  it("nome com parênteses", () => expect(extrairNomeDoEvento(ev("caixa (v2) final"))).toBe("caixa (v2) final"));
  it("texto sem o padrão", () => expect(extrairNomeDoEvento("Analisando...")).toBeNull());
});

describe("exibição", () => {
  it("padrão só sem nome", () => {
    expect(nomePecaExibicao(null)).toBe("Peça aberta no fatiador");
    expect(nomePecaExibicao("")).toBe("Peça aberta no fatiador");
  });
  it("mostra Projeto sem título", () => expect(nomePecaExibicao("Projeto sem título")).toBe("Projeto sem título"));
});
