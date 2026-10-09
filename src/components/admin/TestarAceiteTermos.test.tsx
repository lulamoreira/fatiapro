import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TestarAceiteTermos } from "./TestarAceiteTermos";
import { AceiteTermosModal } from "@/components/fatia/AceiteTermos";
import { TERMOS_VERSAO } from "@/lib/termos";

const mock = vi.hoisted(() => ({
  versao: "1.0" as string | null,
  rpc: vi.fn(),
}));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: { getUser: async () => ({ data: { user: { id: "admin-1" } } }) },
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { termos_versao: mock.versao }, error: null }) }) }) }),
    rpc: mock.rpc,
  },
}));
vi.mock("@tanstack/react-router", () => ({ Link: ({ children }: { children?: React.ReactNode }) => <a>{children}</a> }));

function montar() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={qc}><TestarAceiteTermos /><AceiteTermosModal /></QueryClientProvider>);
  return qc;
}

beforeEach(() => {
  mock.versao = TERMOS_VERSAO;
  mock.rpc.mockReset();
  mock.rpc.mockImplementation(async () => { mock.versao = null; return { error: null }; });
});

describe("teste do próprio aceite", () => {
  it("cancelar a confirmação não altera o aceite", async () => {
    const qc = montar();
    await waitFor(() => expect(qc.getQueryData(["termos-aceite"])).toEqual({ versao: "1.0" }));
    fireEvent.click(screen.getByRole("button", { name: "Testar aceite dos Termos na minha conta" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(mock.rpc).not.toHaveBeenCalled();
    expect(mock.versao).toBe("1.0");
  });

  it("confirmar chama a RPC sem alvo e reabre o modal pela invalidação", async () => {
    const qc = montar();
    await waitFor(() => expect(qc.getQueryData(["termos-aceite"])).toEqual({ versao: "1.0" }));
    fireEvent.click(screen.getByRole("button", { name: "Testar aceite dos Termos na minha conta" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));
    await waitFor(() => expect(mock.rpc.mock.calls).toEqual([["admin_resetar_meu_aceite"]]));
    await waitFor(() => expect(qc.getQueryData(["termos-aceite"])).toEqual({ versao: null }));
    expect(await screen.findByRole("button", { name: "Continuar" })).toBeDisabled();
  });
});