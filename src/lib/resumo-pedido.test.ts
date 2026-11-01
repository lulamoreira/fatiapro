import { describe, it, expect, vi } from "vitest";
import { resumoPedido } from "./resumo-pedido";
import { filtroHistorico, linkHistorico } from "./inicio";

const cheio = {
  impressora: "Bambu Lab A1 0.4 nozzle", bico: "0.4",
  filamento: { tipo: "PLA", marca: "Genérica", linha: "PLA" },
  finalidades: ["Decorativa", "Uso mecânico"], prioridades: ["Tempo", "Acabamento"],
};

describe("resumoPedido", () => {
  it("filamentos distintos por cor têm prioridade sobre tipos", () => {
    expect(resumoPedido({ filamento_misto: { tem: true, tipos: ["TPU"], cores: [{ slot: 1, tipo: "PLA" }, { slot: 2, tipo: "PLA Silk" }, { slot: 3, tipo: "PLA" }] } }, "checklist").chips).toEqual(["Filamentos: PLA, PLA Silk"]);
  });
  it("usa tipos manuais ou mais de um quando vazios", () => {
    expect(resumoPedido({ filamento_misto: { tem: true, tipos: ["PETG", "PETG", "Outro"] } }, "producao").chips).toEqual(["Filamentos: PETG, Outro"]);
    expect(resumoPedido({ filamento_misto: { tem: true } }, "preco").chips).toEqual(["Filamentos: mais de um"]);
    expect(resumoPedido({ filamento_misto: { tem: false } }, "checklist").chips).toEqual([]);
  });
  it("com todos os campos", () => {
    const r = resumoPedido(cheio, "config_geral");
    expect(r.roteiro).toBe("Configurar a peça");
    expect(r.chips).toEqual(["Decorativa, Uso mecânico", "Prioridade: Tempo, Acabamento", "Torre útil: Porta-lápis", "Bambu Lab A1 · 0.4 mm", "Genérica PLA"]);
  });
  it("sem finalidade, prioridade nem impressora não mostra chip vazio", () => {
    const r = resumoPedido({ filamento: { tipo: "PLA", marca: "Genérica", linha: "PLA" } }, "reduzir_tempo");
    expect(r.chips).toEqual(["Torre útil: Porta-lápis", "Genérica PLA"]);
  });
  it("torre útil aparece com um modelo e não aparece com nenhuma nem em outros roteiros", () => {
    expect(resumoPedido({ torre_util: "vaso" }, "config_geral").chips).toEqual(["Torre útil: Vaso torcido"]);
    expect(resumoPedido({ torre_util: "nenhuma" }, "config_geral").chips).toEqual([]);
    expect(resumoPedido({ torre_util: "vaso" }, "checklist").chips).toEqual([]);
  });
  it("perfil com bico entre parênteses", () => {
    expect(resumoPedido({ impressora: "Snapmaker U1 (0.4 nozzle)", bico: "0.4" }, "checklist").chips).toEqual(["Snapmaker U1 · 0.4 mm"]);
  });
  it("job antigo só mostra roteiro", () => {
    expect(resumoPedido(null, "checklist")).toEqual({ roteiro: "Conferir antes de imprimir", chips: [] });
  });
  it("preço de venda mostra quantidade", () => {
    expect(resumoPedido({ preco: { quantidade: 20 } }, "preco").chips).toEqual(["20 un."]);
    expect(resumoPedido({}, "preco").chips).toEqual([]);
  });
});

const chamadas: [string, unknown[]][] = [];
vi.mock("@/integrations/supabase/client", () => {
  const q: Record<string, unknown> = {};
  for (const m of ["select", "in", "eq", "gte", "order"]) q[m] = (...a: unknown[]) => { chamadas.push([m, a]); return q; };
  q["range"] = async () => ({ data: [], error: null, count: 0 });
  return { supabase: { from: () => q } };
});

describe("quadrinho Arquivos otimizados", () => {
  it("abre só Configurar + Reduzir tempo concluídas (mesma conta do kpis_usuario)", async () => {
    const l = linkHistorico({ estado: "concluido", roteiro: "otimizacao" });
    expect(l.search).toEqual({ estado: "concluido", roteiro: "otimizacao" });
    const { historicoQuery } = await import("./queries");
    chamadas.length = 0;
    await historicoQuery(0, filtroHistorico(l.search)).queryFn!({} as never);
    expect(chamadas).toContainEqual(["in", ["estado", ["concluido"]]]);
    expect(chamadas).toContainEqual(["in", ["roteiro", ["config_geral", "reduzir_tempo"]]]);
  });
});
