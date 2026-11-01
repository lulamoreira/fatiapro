import { describe, expect, it, vi } from "vitest";
import { avisoPodeVoltar, precisaAtualizar, temBotao, ponteNovaQuery } from "./atualizacao-ponte";

const { range, select, eq, order } = vi.hoisted(() => ({ range: vi.fn(), select: vi.fn(), eq: vi.fn(), order: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => {
  const q = { select, eq, order, range };
  for (const fn of [select, eq, order]) fn.mockReturnValue(q);
  return { supabase: { from: () => q } };
});
const device = { sistema: "macos", versao_ponte: "0.3.51" };
const versao = { versao: "0.3.52", plataforma: "macos", notas: null };
describe("atualização da ponte", () => {
  it("devolve a maior versão da mesma plataforma", () => expect(precisaAtualizar(device, [versao, { ...versao, versao: "0.3.60" }])?.versao).toBe("0.3.60"));
  it("não sugere versão igual", () => expect(precisaAtualizar(device, [{ ...versao, versao: "0.3.51" }])).toBeNull());
  it("não sugere plataforma diferente", () => expect(precisaAtualizar(device, [{ ...versao, plataforma: "windows" }])).toBeNull());
  it("não sugere quando versão atual está vazia", () => expect(precisaAtualizar({ ...device, versao_ponte: "" }, [versao])).toBeNull());
  it("não sugere downgrade", () => expect(precisaAtualizar(device, [{ ...versao, versao: "0.3.50" }])).toBeNull());
  it("botão disponível a partir de 0.3.51", () => {
    expect(temBotao("0.3.50")).toBe(false);
    expect(temBotao("0.3.51")).toBe(true);
    expect(temBotao("0.3.52")).toBe(true);
    expect(temBotao(null)).toBe(false);
  });
  it("Depois esconde por 24 horas exatas", () => {
    const inicio = 1_000_000;
    expect(avisoPodeVoltar(String(inicio), inicio + 24 * 60 * 60_000 - 1)).toBe(false);
    expect(avisoPodeVoltar(String(inicio), inicio + 24 * 60 * 60_000)).toBe(true);
    expect(avisoPodeVoltar(null, inicio)).toBe(true);
  });
  it("busca todas as versões publicadas com contagem e ordem estável", async () => {
    range.mockResolvedValueOnce({ data: Array.from({ length: 1000 }, () => versao), count: 1001, error: null })
      .mockResolvedValueOnce({ data: [versao], count: 1001, error: null });
    const fn = ponteNovaQuery.queryFn;
    if (typeof fn !== "function") throw new Error("Query ausente");
    expect(await fn({} as never)).toHaveLength(1001);
    expect(select).toHaveBeenCalledWith("versao, plataforma, notas", { count: "exact" });
    expect(eq).toHaveBeenCalledWith("publicada", true);
    expect(order).toHaveBeenCalledWith("criado_em", { ascending: false });
    expect(order).toHaveBeenCalledWith("id", { ascending: false });
    expect(range).toHaveBeenNthCalledWith(1, 0, 999);
    expect(range).toHaveBeenNthCalledWith(2, 1000, 1999);
  });
});