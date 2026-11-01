import { useState } from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { FORM_INICIAL } from "@/components/fatia/form";
import { useCoresPeca } from "./use-cores-peca";
import { coresDo3mf, type Cor3mf } from "@/lib/cores-3mf";

vi.mock("@tanstack/react-query", () => ({ useQueryClient: () => qc }));
const qc = { fetchQuery: vi.fn() };
vi.mock("@/integrations/supabase/client", () => ({ supabase: { storage: {} } }));
vi.mock("@/lib/cores-3mf", async (original) => ({ ...await original<typeof import("@/lib/cores-3mf")>(), coresDo3mf: vi.fn() }));

describe("useCoresPeca", () => {
  it("ignore une lecture ancienne et vide les slots quand la pièce change", async () => {
    let terminer: ((v: Cor3mf[] | null) => void) | undefined;
    vi.mocked(coresDo3mf).mockImplementationOnce(() => new Promise((resolve) => { terminer = resolve; }));
    const { result, rerender } = renderHook(({ file, ouverte }) => {
      const [form, setF] = useState({ ...FORM_INICIAL, filMisto: true, filMistoCores: [{ slot: 9, tipo: "TPU" }] });
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