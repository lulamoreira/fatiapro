import { describe, expect, it } from "vitest";
import { TERMOS_VERSAO, precisaAceitarTermos } from "./termos";
import { PRIVACIDADE_SECOES, TERMOS_SECOES } from "./termos-texto";

describe("aceite dos termos", () => {
  it("versão atual é 1.0", () => expect(TERMOS_VERSAO).toBe("1.0"));
  it("sem aceite pede aceite", () => expect(precisaAceitarTermos(null)).toBe(true));
  it("versão diferente pede novo aceite", () => expect(precisaAceitarTermos("0.9")).toBe(true));
  it("versão atual não pede", () => expect(precisaAceitarTermos("1.0")).toBe(false));
  it("textos têm 17 e 12 seções", () => {
    expect(TERMOS_SECOES).toHaveLength(17);
    expect(PRIVACIDADE_SECOES).toHaveLength(12);
  });
});
