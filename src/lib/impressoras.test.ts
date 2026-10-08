import { describe, it, expect } from "vitest";
import { agruparImpressoras, opcoesImpressora, autoImpressora, bicoPadrao } from "./fatia";

describe("agruparImpressoras", () => {
  const g = agruparImpressoras([
    "Snapmaker U1 (0.4+0.6 nozzle)", "Bambu Lab A1 0.6 nozzle", "Bambu Lab A1 0.4 nozzle", "Snapmaker U1 (0.4 nozzle)",
    "Anycubic Kobra X 0.4 nozzle", "Bambu Lab P1S 0.4 nozzle - Copy", "Minha Máquina",
  ]);
  it("ordena por marca e modelo, Outras por último", () =>
    expect(g.map((x) => x.modelo)).toEqual(["Anycubic Kobra X", "Bambu Lab A1", "Bambu Lab P1S - Copy", "Snapmaker U1", "Minha Máquina"]));
  it("bicos em ordem numérica e 0.4+0.6 é um bico próprio", () => {
    expect(g[1]!.bicos.map((b) => b.bico)).toEqual(["0.4", "0.6"]);
    expect(g[3]!.bicos).toEqual([{ bico: "0.4", perfil: "Snapmaker U1 (0.4 nozzle)" }, { bico: "0.4+0.6", perfil: "Snapmaker U1 (0.4+0.6 nozzle)" }]);
  });
  it("- Copy mantém o bico; nome sem bico vira bico —", () => {
    expect(g[2]!.bicos).toEqual([{ bico: "0.4", perfil: "Bambu Lab P1S 0.4 nozzle - Copy" }]);
    expect(g[4]).toEqual({ marca: "Outras", modelo: "Minha Máquina", bicos: [{ bico: "—", perfil: "Minha Máquina" }] });
  });
  it("marcar o modelo escolhe o 0.4", () => expect(bicoPadrao(g[1]!)).toBe("Bambu Lab A1 0.4 nozzle"));
});

describe("Nova análise: impressoras", () => {
  const todos = ["Bambu Lab A1 0.4 nozzle", "Bambu Lab A1 0.6 nozzle", "Anycubic Kobra X 0.4 nozzle"];
  it("com escolha só aparecem os modelos/bicos escolhidos e perfis sumidos são ignorados", () => {
    const o = opcoesImpressora(todos, ["Bambu Lab A1 0.6 nozzle", "Sumiu 0.4 nozzle"], null);
    expect(o.filtrado).toBe(true);
    expect(o.modelos.map((m) => [m.modelo, m.bicos.map((b) => b.bico)])).toEqual([["Bambu Lab A1", ["0.6"]]]);
  });
  it("1 modelo e 1 bico já vêm selecionados", () => {
    expect(autoImpressora(opcoesImpressora(todos, ["Bambu Lab A1 0.6 nozzle"], null).modelos)).toEqual({ modelo: "Bambu Lab A1", perfil: "Bambu Lab A1 0.6 nozzle" });
  });
  it("sem escolha aparece tudo", () => {
    const o = opcoesImpressora(todos, undefined, null);
    expect(o.filtrado).toBe(false);
    expect(o.modelos).toHaveLength(2);
  });
  it("perfil salvo fora da escolha aparece marcado", () => {
    const o = opcoesImpressora(todos, ["Bambu Lab A1 0.6 nozzle"], "Anycubic Kobra X 0.4 nozzle");
    expect(o.modelos.find((m) => m.modelo === "Anycubic Kobra X")?.fora).toBe(true);
  });
});
