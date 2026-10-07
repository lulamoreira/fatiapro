import { describe, it, expect } from "vitest";
import { caminhoBridge, caminhoOriginal, nomeDownloadOtimizado, nomeDownloadOriginal, validarNomeArquivo } from "./nomes";

describe("nomes de arquivo", () => {
  it("aceita nomes chineses e com acentos", () => {
    expect(validarNomeArquivo("零件.3mf")).toBe("零件.3mf");
    expect(validarNomeArquivo("peça.STL")).toBe("peça.STL");
  });
  it("rejeita barras, \\0, vazio, >200 e extensão inválida", () => {
    expect(validarNomeArquivo("a/b.3mf")).toBeNull();
    expect(validarNomeArquivo("a\\b.3mf")).toBeNull();
    expect(validarNomeArquivo("a\0.3mf")).toBeNull();
    expect(validarNomeArquivo("  ")).toBeNull();
    expect(validarNomeArquivo("a".repeat(197) + ".3mf")).toBeNull();
    expect(validarNomeArquivo("a.gcode")).toBeNull();
  });
  it("monta caminhos só com caracteres seguros", () => {
    expect(caminhoOriginal("u", "x", "3mf")).toBe("u/x/original.3mf");
    expect(caminhoBridge("u", "j", "otimizado", "x", "stl")).toBe("u/j/otimizado/x.stl");
  });
  it("usa nomes de fallback para registros antigos", () => {
    expect(nomeDownloadOriginal(null, "peça.3mf")).toBe("peça.3mf");
    expect(nomeDownloadOtimizado(null)).toBe("otimizado.3mf");
  });
});
