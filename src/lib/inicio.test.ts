import { describe, it, expect, vi } from "vitest";
import { filtroHistorico, formatHorasMin, formatPct, formatPeso, formatReais, inicioMesSP, lerAdminSearch, lerHistoricoSearch, lerOrcSearch, linkAdmin, linkHistorico, linkOrc } from "./inicio";

const chamadas: [string, unknown[]][] = [];
vi.mock("@/integrations/supabase/client", () => {
  const q: Record<string, unknown> = {};
  for (const m of ["select", "in", "eq", "gte", "order"]) q[m] = (...a: unknown[]) => { chamadas.push([m, a]); return q; };
  q["range"] = async () => ({ data: [], error: null, count: 0 });
  return { supabase: { from: () => q } };
});

describe("formatação", () => {
  it("horas e minutos", () => {
    expect(formatHorasMin(12 * 3600 + 40 * 60)).toBe("12h 40min");
    expect(formatHorasMin(45 * 60)).toBe("45min");
    expect(formatHorasMin(7200)).toBe("2h");
  });
  it("g e kg", () => {
    expect(formatPeso(850)).toBe("850 g");
    expect(formatPeso(1234)).toBe("1,2 kg");
  });
  it("R$ e %", () => {
    expect(formatReais(1234.56).replace(/\s/g, " ")).toBe("R$ 1.234,56");
    expect(formatPct(1, 3)).toBe("33%");
    expect(formatPct(0, 0)).toBe("—");
  });
});

describe("links dos quadrinhos", () => {
  it("histórico", () => {
    expect(linkHistorico({ estado: "erro", periodo: "30d" })).toEqual({ to: "/app/historico", search: { estado: "erro", periodo: "30d" } });
    expect(linkHistorico({ estado: "concluido", roteiro: "reduzir_tempo" }).search).toEqual({ estado: "concluido", roteiro: "reduzir_tempo" });
  });
  it("orçamentos e admin", () => {
    expect(linkOrc("aprovado")).toEqual({ to: "/app/orcamentos", search: { status: "aprovado" } });
    expect(linkAdmin("usuarios", "sem_computador")).toEqual({ to: "/app/admin", search: { aba: "usuarios", filtro: "sem_computador" } });
    expect(linkAdmin("financeiro")).toEqual({ to: "/app/admin", search: { aba: "financeiro" } });
  });
  it("valores inválidos no endereço são ignorados", () => {
    expect(lerHistoricoSearch({ estado: "xyz", roteiro: "preco", pagina: "2" })).toEqual({ roteiro: "preco", pagina: 2 });
    expect(lerOrcSearch({ status: "outro" })).toEqual({});
    expect(lerAdminSearch({ aba: "cupons", filtro: "nada" })).toEqual({ aba: "cupons" });
  });
});

describe("filtro do Histórico", () => {
  const agora = new Date("2026-10-09T18:00:00Z");
  it("em andamento vira três estados", () => {
    expect(filtroHistorico({ estado: "em_andamento" }).estados).toEqual(["na_fila", "analisando", "aplicando"]);
  });
  it("mês começa no dia 1 em Brasília", () => {
    expect(inicioMesSP(agora).toISOString()).toBe("2026-10-01T03:00:00.000Z");
    expect(filtroHistorico({ periodo: "30d" }, agora).desde).toBe("2026-09-09T18:00:00.000Z");
  });
  it("a consulta filtra no banco", async () => {
    const { historicoQuery } = await import("./queries");
    chamadas.length = 0;
    await historicoQuery(0, filtroHistorico({ estado: "erro", roteiro: "checklist", periodo: "30d" }, agora)).queryFn!({} as never);
    expect(chamadas).toContainEqual(["in", ["estado", ["erro"]]]);
    expect(chamadas).toContainEqual(["eq", ["roteiro", "checklist"]]);
    expect(chamadas).toContainEqual(["gte", ["criado_em", "2026-09-09T18:00:00.000Z"]]);
  });
});
