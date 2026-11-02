import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Tables } from "@/integrations/supabase/types";
import { SalvarBibliotecaDialog } from "./SalvarBibliotecaDialog";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() } }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
vi.mock("@tanstack/react-router", () => ({ Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a> }));
vi.mock("@tanstack/react-query", async (original) => ({
  ...await original<typeof import("@tanstack/react-query")>(),
  useQuery: () => ({ data: undefined }),
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}));

const NOME_OTIMIZADO = "Nossa_senhora_teste_Snapmaker-U1-(0.4-nozzle)_0.4mm_Generico-PLA_2026-11-02_12h18.3mf";

function job(resultado: unknown, nomePeca: string | null = "Peca_original.stl") {
  return { id: "j1", nome_peca: nomePeca, arquivo_path: "u/original.3mf", resultado } as unknown as Tables<"jobs">;
}

async function abrir(j: Tables<"jobs">) {
  render(<SalvarBibliotecaDialog job={j} />);
  fireEvent.click(screen.getByRole("button", { name: /salvar na biblioteca/i }));
  return (await screen.findByLabelText("Nome")) as HTMLInputElement;
}

describe("sugestão de nome ao salvar na biblioteca", () => {
  it("sugere o nome do arquivo otimizado, sem a extensão", async () => {
    const input = await abrir(job({ arquivo_nuvem_nome: NOME_OTIMIZADO }));
    expect(input.value).toBe("Nossa_senhora_teste_Snapmaker-U1-(0.4-nozzle)_0.4mm_Generico-PLA_2026-11-02_12h18");
  });

  it("volta ao nome original quando a análise não tem arquivo otimizado", async () => {
    const input = await abrir(job({}));
    expect(input.value).toBe("Peca_original");
  });

  it("corta a sugestão em 120 caracteres", async () => {
    const longo = `${"a".repeat(150)}.3mf`;
    const input = await abrir(job({ arquivo_nuvem_nome: longo }));
    expect(input.value).toHaveLength(120);
  });
});
