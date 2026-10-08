import { describe, expect, it } from "vitest";
import { escolherMotor } from "./motor-choice";

describe("seleção do Claude no Resumo", () => {
  it("usa o motor da última análise se disponível", () => {
    expect(escolherMotor(null, "assinatura", ["assinatura", "api"])).toBe("assinatura");
  });
  it("prefere API quando o motor anterior não está disponível", () => {
    expect(escolherMotor(null, "assinatura", ["api"])).toBe("api");
  });
  it("prefere FatiaProAI sem análise anterior", () => {
    expect(escolherMotor(null, null, ["fatiapro", "assinatura", "api"])).toBe("fatiapro");
  });
  it("seleciona a única opção", () => {
    expect(escolherMotor(null, null, ["assinatura"])).toBe("assinatura");
  });
  it("preserva a escolha explícita disponível", () => {
    expect(escolherMotor("api", "assinatura", ["assinatura", "api"])).toBe("api");
  });
  it("não seleciona um motor indisponível", () => {
    expect(escolherMotor("assinatura", "api", [])).toBeNull();
  });
});