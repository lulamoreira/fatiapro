import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";

import { AceiteTermosModal } from "./AceiteTermos";
import { TERMOS_VERSAO } from "@/lib/termos";

// O banco diz que o usuário ainda não aceitou nenhuma versão dos termos.
const { rpc } = vi.hoisted(() => ({ rpc: vi.fn(async () => ({ error: null })) }));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: { getUser: async () => ({ data: { user: { id: "u-1" } } }) },
    from: () => ({
      select: () => ({
        eq: () => ({ maybeSingle: async () => ({ data: { termos_versao: null }, error: null }) }),
      }),
    }),
    rpc,
  },
}));

// O modal usa <Link> no texto do aceite; aqui basta um <a>.
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { children?: ReactNode }) => <a>{children}</a>,
}));

function renderModal() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <AceiteTermosModal />
    </QueryClientProvider>,
  );
}

describe("modal de aceite dos termos", () => {
  it("mostra o botão Continuar, desabilitado até marcar a caixa", async () => {
    renderModal();
    const botao = await screen.findByRole("button", { name: "Continuar" });
    expect(botao).toBeVisible();
    expect(botao).toBeDisabled();
    fireEvent.click(screen.getByRole("checkbox"));
    expect(botao).toBeEnabled();
  });

  it("grava o aceite e fecha o modal ao clicar em Continuar", async () => {
    renderModal();
    const botao = await screen.findByRole("button", { name: "Continuar" });
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(botao);
    await waitFor(() => expect(rpc).toHaveBeenCalledWith("aceitar_termos", { p_versao: TERMOS_VERSAO }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });
});
