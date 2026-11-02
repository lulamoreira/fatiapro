import { describe, expect, it } from "vitest";
import { kwhEstimado, KWH_MEDIO_UF } from "./energia";

describe("média de energia", () => {
  it("usa a média da UF válida", () => expect(kwhEstimado("SP")).toEqual({ valor: 1.06, origem: "média de SP" }));
  it.each([null, undefined])("usa Brasil sem UF: %s", (uf) => expect(kwhEstimado(uf)).toEqual({ valor: 1.14, origem: "média do Brasil" }));
  it.each(["XX", "sp", "toString", ""]) ("usa Brasil com UF inválida: %s", (uf) => expect(kwhEstimado(uf)).toEqual({ valor: 1.14, origem: "média do Brasil" }));
  it("mantém todas as 27 médias solicitadas", () => expect(KWH_MEDIO_UF).toEqual({ AC: 1.11, AL: 1.14, AM: 1.17, AP: 1.10, BA: 1.17, CE: 0.94, DF: 1.11, ES: 1.13, GO: 1.27, MA: 1.19, MG: 1.20, MS: 1.32, MT: 1.20, PA: 1.39, PB: 0.95, PE: 1.07, PI: 1.26, PR: 1.02, RJ: 1.29, RN: 1.03, RO: 1.02, RR: 1.05, RS: 1.18, SC: 1.01, SE: 1.01, SP: 1.06, TO: 1.32 }));
});