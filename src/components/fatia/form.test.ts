import { describe, expect, it } from "vitest";
import { FORM_INICIAL, fromOpcoes, toOpcoes, validar } from "./form";

const base = { ...FORM_INICIAL, roteiro: "producao" as const };

describe("kWh opcional", () => {
  const f = { ...FORM_INICIAL, roteiro: "preco" as const, preco: { ...FORM_INICIAL.preco, uf: "SP" } };
  it("aceita vazio sem exigir estado", () => expect(validar({ ...f, preco: { ...f.preco, uf: null, kwh: "" } }, false).kwh).toBeUndefined());
  it.each(["0", "-1", "abc", "Infinity", "NaN"])("recusa preenchido inválido: %s", (kwh) => expect(validar({ ...f, preco: { ...f.preco, kwh } }, false).kwh).toBeTruthy());
  it("aceita preenchido positivo", () => expect(validar({ ...f, preco: { ...f.preco, kwh: "1,50" } }, false).kwh).toBeUndefined());
  it("valor digitado tem preferência e omite origem", () => {
    const p = toOpcoes({ ...f, preco: { ...f.preco, kwh: "1,50" } }).preco;
    expect(p?.kwh_brl).toBe(1.5);
    expect(p).not.toHaveProperty("kwh_estimado");
  });
  it("vazio envia média e origem da UF", () => expect(toOpcoes(f).preco).toMatchObject({ uf: "SP", kwh_brl: 1.06, kwh_estimado: "média de SP" }));
  it("sem estado envia Brasil", () => expect(toOpcoes({ ...f, preco: { ...f.preco, uf: null } }).preco).toMatchObject({ kwh_brl: 1.14, kwh_estimado: "média do Brasil" }));
  it("restaura UF e mantém estimativa como campo vazio", () => {
    const r = fromOpcoes({ roteiro: "preco" }, toOpcoes(f));
    expect(r.preco.uf).toBe("SP");
    expect(r.preco.kwh).toBe("");
    expect(toOpcoes(r).preco?.kwh_brl).toBe(1.06);
  });
  it("restaura antigos sem UF e preserva tarifa manual", () => {
    expect(fromOpcoes({}, { preco: { kwh_brl: 0.9 } }).preco).toMatchObject({ uf: undefined, kwh: "0.9" });
    expect(fromOpcoes({}, {}).preco.uf).toBeUndefined();
  });
  it("restaura ausência explícita de estado", () => expect(fromOpcoes({}, { preco: { uf: null } }).preco.uf).toBeNull());
});

describe("impressora explícita", () => {
  it("nova análise começa sem impressora e exige escolha", () => {
    expect(FORM_INICIAL.impressora).toBeNull();
    expect(validar({ ...base, fatiador: "bambu" }, false).impressora).toBe("Escolha a impressora.");
  });
  it("restaura o perfil de análise repetida ou modelo salvo", () => {
    expect(fromOpcoes({}, { impressora: "Bambu Lab A1 0.6 nozzle", bico: 0.6 }).impressora).toBe("Bambu Lab A1 0.6 nozzle");
  });
});

describe("filamento misto", () => {
  it("Sim envia tipos e cores", () => {
    expect(toOpcoes({ ...base, filMisto: true, filMistoTipos: ["PETG"], filMistoCores: [{ slot: 1, tipo: "PLA Silk" }] })).toMatchObject({ filamento_misto: { tem: true, tipos: ["PETG"], cores: [{ slot: 1, tipo: "PLA Silk" }] } });
  });
  it("Não envia somente tem false", () => expect(toOpcoes({ ...base, filMisto: false })).toMatchObject({ filamento_misto: { tem: false } }));
  it("sem resposta omite o campo", () => expect(toOpcoes(base)).not.toHaveProperty("filamento_misto"));
  it("restaura seleção válida", () => {
    expect(fromOpcoes({}, { filamento_misto: { tem: true, tipos: ["TPU"], cores: [{ slot: 2, tipo: "PLA Silk" }] } })).toMatchObject({ filMisto: true, filMistoTipos: ["TPU"], filMistoCores: [{ slot: 2, tipo: "PLA Silk" }] });
    expect(fromOpcoes({}, { filamento_misto: { tem: false } }).filMisto).toBe(false);
  });
  it.each([null, "sim", { tem: "true" }, { tem: true, tipos: [42] }, { tem: true, cores: [{ slot: 0, tipo: "PLA" }] }, { tem: true, cores: [{ slot: 1.5, tipo: "PLA" }] }, { tem: true, cores: [{ slot: 1, tipo: 42 }] }])("restauração inválida volta ao inicial: %j", (raw) => {
    expect(fromOpcoes({}, { filamento_misto: raw })).toMatchObject({ filMisto: null, filMistoTipos: [], filMistoCores: [] });
  });
  it("resposta não altera validação", () => expect(validar({ ...base, filMisto: true }, false)).toEqual(validar(base, false)));
});

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

describe("toOpcoes — torre útil", () => {
  it("envia torre_util em config_geral, reduzir_tempo e producao", () => {
    expect(toOpcoes({ ...FORM_INICIAL, roteiro: "config_geral", torreUtil: "vaso" })).toMatchObject({ torre_util: "vaso" });
    expect(toOpcoes({ ...FORM_INICIAL, roteiro: "reduzir_tempo", torreUtil: "caixa" })).toMatchObject({ torre_util: "caixa" });
    expect(toOpcoes({ ...FORM_INICIAL, roteiro: "producao", torreUtil: "vaso" })).toMatchObject({ torre_util: "vaso" });
    expect("torre_util" in toOpcoes({ ...FORM_INICIAL, roteiro: "checklist", torreUtil: "vaso" })).toBe(false);
    expect("torre_util" in toOpcoes({ ...FORM_INICIAL, roteiro: "preco", torreUtil: "vaso" })).toBe(false);
  });

  it("valor inicial é ovo", () => {
    expect(FORM_INICIAL.torreUtil).toBe("ovo");
  });
});

describe("fromOpcoes — torre útil", () => {
  it("recupera valor válido salvo", () => {
    expect(fromOpcoes({}, { torre_util: "porta_copo" }).torreUtil).toBe("porta_copo");
    expect(fromOpcoes({}, { torre_util: "nenhuma" }).torreUtil).toBe("nenhuma");
  });

  it("valor inválido ou ausente vira ovo", () => {
    expect(fromOpcoes({}, { torre_util: "foguete" }).torreUtil).toBe("ovo");
    expect(fromOpcoes({}, { torre_util: 42 }).torreUtil).toBe("ovo");
    expect(fromOpcoes({}, {}).torreUtil).toBe("ovo");
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
