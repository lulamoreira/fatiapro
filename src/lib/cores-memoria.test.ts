import { beforeEach, describe, expect, it } from "vitest";
import { guardarMemoriaCores, lerMemoriaCores, tipoInicial } from "@/lib/cores-3mf";

const K = "fatiapro.cores_filamento";
beforeEach(() => localStorage.clear());

describe("memória de cores", () => {
  it("vazia e inválida devolvem {}", () => {
    expect(lerMemoriaCores()).toEqual({});
    localStorage.setItem(K, "{oops");
    expect(lerMemoriaCores()).toEqual({});
    localStorage.setItem(K, "[1,2]");
    expect(lerMemoriaCores()).toEqual({});
  });
  it("lembra Silk por cor sem diferenciar maiúsculas", () => {
    guardarMemoriaCores([{ slot: 1, cor: "#ffd700", perfil: "Generic PLA" }], [{ slot: 1, tipo: "PLA Silk" }]);
    expect(lerMemoriaCores()).toEqual({ "#FFD700": "PLA Silk" });
    expect(tipoInicial("Generic PLA", "#FfD700", lerMemoriaCores())).toBe("PLA Silk");
  });
  it("perfil não PLA vence a memória", () => {
    expect(tipoInicial("Bambu PETG Basic", "#FFD700", { "#FFD700": "PLA Silk" })).toBe("PETG");
  });
  it("voltar a PLA remove a cor", () => {
    const c = [{ slot: 1, cor: "#FFD700", perfil: "PLA" }];
    guardarMemoriaCores(c, [{ slot: 1, tipo: "PLA Silk" }]);
    guardarMemoriaCores(c, [{ slot: 1, tipo: "PLA" }]);
    expect(lerMemoriaCores()).toEqual({});
  });
  it("limita a 200 cores mais recentes", () => {
    const cores = Array.from({ length: 205 }, (_, i) => ({ slot: i + 1, cor: `#${i.toString(16).padStart(6, "0")}`, perfil: "PLA" }));
    guardarMemoriaCores(cores, cores.map((c) => ({ slot: c.slot, tipo: "PLA Silk" })));
    const m = lerMemoriaCores();
    expect(Object.keys(m)).toHaveLength(200);
    expect(m["#000000"]).toBeUndefined();
    expect(m["#0000CC"]).toBe("PLA Silk");
  });
});
