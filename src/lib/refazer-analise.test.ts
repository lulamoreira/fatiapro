import { describe, it, expect } from "vitest";
import { podeRefazer, veioDePecaAberta } from "./refazer-analise";

describe("podeRefazer", () => {
  it("aparece em concluída, com erro e cancelada", () => {
    expect(podeRefazer("concluido")).toBe(true);
    expect(podeRefazer("erro")).toBe(true);
    expect(podeRefazer("cancelado")).toBe(true);
  });
  it("não aparece durante a execução nem esperando aprovação", () => {
    expect(podeRefazer("na_fila")).toBe(false);
    expect(podeRefazer("analisando")).toBe(false);
    expect(podeRefazer("aguardando_aprovacao")).toBe(false);
    expect(podeRefazer("aplicando")).toBe(false);
  });
});

describe("veioDePecaAberta", () => {
  it("verdadeiro só com usar_peca_aberta true", () => {
    expect(veioDePecaAberta({ usar_peca_aberta: true })).toBe(true);
    expect(veioDePecaAberta({ usar_peca_aberta: false })).toBe(false);
    expect(veioDePecaAberta({})).toBe(false);
    expect(veioDePecaAberta(null)).toBe(false);
    expect(veioDePecaAberta([true])).toBe(false);
  });
});
