import { describe, expect, it } from "vitest";
import { formatarContato, formatarDocumento, formatarTelefone } from "./mascaras";

describe("documento", () => {
  it.each([
    ["", ""], ["12345678901", "123.456.789-01"], ["12345678901234", "12.345.678/9012-34"],
    ["123", "123"], ["1234", "123.4"], ["123456", "123.456"], ["1234567890", "123.456.789-0"],
    ["123456789012", "12.345.678/9012"], ["1234567890123", "12.345.678/9012-3"],
    ["a123b456c78901", "123.456.789-01"], ["123456789012345678", "12.345.678/9012-34"],
  ])("formata %s", (entrada, esperado) => expect(formatarDocumento(entrada)).toBe(esperado));
  it("permite apagar até vazio sem prender separadores", () => {
    let v = formatarDocumento("12345678901234");
    for (let i = 0; i < 20; i++) v = formatarDocumento(v.slice(0, -1));
    expect(v).toBe("");
  });
});

describe("telefone", () => {
  it.each([
    ["", ""], ["11977749746", "(11) 97774-9746"], ["1133334444", "(11) 3333-4444"],
    ["1", "(1"], ["11", "(11"], ["119", "(11) 9"], ["113333", "(11) 3333"],
    ["1133334", "(11) 3333-4"], ["a11b3333c4444", "(11) 3333-4444"],
    ["+55 11 97774-9746", "+55 11 97774-9746"], ["5511977749746", "5511977749746"],
  ])("formata %s", (entrada, esperado) => expect(formatarTelefone(entrada)).toBe(esperado));
  it("permite apagar até vazio sem prender separadores", () => {
    let v = formatarTelefone("11977749746");
    for (let i = 0; i < 20; i++) v = formatarTelefone(v.slice(0, -1));
    expect(v).toBe("");
  });
  it("preserva e-mail no contato do orçamento", () => expect(formatarContato("ana@example.com")).toBe("ana@example.com"));
});