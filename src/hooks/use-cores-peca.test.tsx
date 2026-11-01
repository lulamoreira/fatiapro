import { useState } from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { FORM_INICIAL, type FormState } from "@/components/fatia/form";
import { useCoresPeca } from "./use-cores-peca";
import { coresDo3mf, type Cor3mf } from "@/lib/cores-3mf";

vi.mock("@tanstack/react-query", () => ({ useQueryClient: () => qc }));
const qc = { fetchQuery: vi.fn() };
vi.mock("@/integrations/supabase/client", () => ({ supabase: { storage: {} } }));
vi.mock("@/lib/cores-3mf", async (original) => ({ ...await original<typeof import("@/lib/cores-3mf")>(), coresDo3mf: vi.fn() }));

describe("useCoresPeca", () => {
  it("ignora leitura antiga e limpa os slots quando a peça muda", async () => {
    let terminer: ((v: Cor3mf[] | null) => void) | undefined;
    vi.mocked(coresDo3mf).mockImplementationOnce(() => new Promise((resolve) => { terminer = resolve; }));
    const { result, rerender } = renderHook(({ file, ouverte }) => {
      const [form, setF] = useState<FormState>({ ...FORM_INICIAL, filMisto: true, filMistoCores: [{ slot: 9, tipo: "TPU" }] });
      const cores = useCoresPeca(file, null, ouverte, setF);
      return { cores, form };
    }, { initialProps: { file: new File(["zip"], "a.3mf"), ouverte: false } });
    await waitFor(() => expect(result.current.form.filMistoCores).toEqual([]));
    rerender({ file: new File(["stl"], "b.stl"), ouverte: false });
    await act(async () => terminer?.([{ slot: 1, cor: "#ffffff", perfil: "PLA" }, { slot: 2, cor: "#ff0000", perfil: "PETG" }]));
    expect(result.current.cores).toBeNull();
    expect(result.current.form.filMistoCores).toEqual([]);
    rerender({ file: new File(["zip"], "c.3mf"), ouverte: true });
    expect(result.current.cores).toBeNull();
  });
});
describe("useCoresPeca com memória", () => {
  const cores: Cor3mf[] = [{ slot: 1, cor: "#ffffff", perfil: "Generic PLA" }, { slot: 2, cor: "#ffd700", perfil: "Generic PLA" }];
  function montar(filMisto: boolean | null) {
    localStorage.setItem("fatiapro.cores_filamento", JSON.stringify({ "#FFD700": "PLA Silk" }));
    vi.mocked(coresDo3mf).mockResolvedValueOnce(cores);
    const file = new File(["zip"], "x.3mf");
    return renderHook(() => {
      const [form, setF] = useState<FormState>({ ...FORM_INICIAL, filMisto });
      useCoresPeca(file, null, false, setF);
      return form;
    });
  }
  it("marca Sim automaticamente com cor lembrada", async () => {
    const { result } = montar(null);
    await waitFor(() => expect(result.current.filMisto).toBe(true));
    expect(result.current.filMistoCores).toEqual([{ slot: 1, tipo: "PLA" }, { slot: 2, tipo: "PLA Silk" }]);
  });
  it("respeita a resposta Não", async () => {
    const { result } = montar(false);
    await waitFor(() => expect(vi.mocked(coresDo3mf)).toHaveBeenCalled());
    await act(async () => { await Promise.resolve(); });
    expect(result.current.filMisto).toBe(false);
    expect(result.current.filMistoCores).toEqual([]);
  });
});
