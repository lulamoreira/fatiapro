import { describe, expect, it } from "vitest";
import { FORM_INICIAL, fromOpcoes, toOpcoes, validar } from "./form";

const base = { ...FORM_INICIAL, roteiro: "producao" as const };

describe("toOpcoes — produção em lote", () => {
  it("envia quantidade como número quando preenchida", () => {
    const o = toOpcoes({ ...base, prodQuantidade: "250" });
    expect(o).toMatchObject({ quantidade: 250 });
    expect(typeof (o as { quantidade?: unknown }).quantidade).toBe("number");
  });

  it("omite quantidade quando vazia", () => {
    const o = toOpcoes({ ...base, prodQuantidade: "" });
    expect("quantidade" in o).toBe(false);
  });

  it("omite quantidade em outros roteiros", () => {
    const o = toOpcoes({ ...base, roteiro: "reduzir_tempo", prodQuantidade: "10" });
    expect("quantidade" in o).toBe(false);
  });

  it("fromOpcoes recupera a quantidade salva", () => {
    expect(fromOpcoes({ roteiro: "producao" }, { quantidade: 40 }).prodQuantidade).toBe("40");
  });
});

describe("validar — quantidade da produção", () => {
  const ok = { ...base, deviceId: "d", fatiador: "bambu", usarAberta: true, impressora: "A1", filTipo: "PLA", filMarca: "Genérica", filLinha: "PLA", motor: "fatiapro" as const };
  it("vazia é válida (encher uma placa)", () => {
    expect(validar({ ...ok, prodQuantidade: "" }, false).prodQuantidade).toBeUndefined();
  });
  it("inteiro de 1 a 5000 é válido", () => {
    expect(validar({ ...ok, prodQuantidade: "5000" }, false).prodQuantidade).toBeUndefined();
  });
  it("fora da faixa ou quebrado é recusado", () => {
    expect(validar({ ...ok, prodQuantidade: "0" }, false).prodQuantidade).toBeTruthy();
    expect(validar({ ...ok, prodQuantidade: "5001" }, false).prodQuantidade).toBeTruthy();
    expect(validar({ ...ok, prodQuantidade: "2.5" }, false).prodQuantidade).toBeTruthy();
  });
});
