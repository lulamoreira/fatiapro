import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AvisoPonteNova, BotaoAtualizarPonte, BotaoPonteSempre } from "./AtualizarPonte";

const state = vi.hoisted(() => ({ abertas: 0, enviar: vi.fn(), toast: vi.fn(),
  cmd: null as null | { id: string; estado: string; resposta: Record<string, unknown> } }));
const now = 2_000_000;
vi.mock("@/hooks/use-now", () => ({ useNow: () => now }));
vi.mock("@/components/fatia/EnviarComando", () => ({ useComando: () => ({ cmd: state.cmd, ocupado: false, enviar: state.enviar }) }));
vi.mock("sonner", () => ({ toast: { warning: state.toast } }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
vi.mock("@tanstack/react-query", async (original) => ({
  ...await original<typeof import("@tanstack/react-query")>(),
  useQuery: (q: { queryKey: string[] }) => ({ isFetched: true, data: q.queryKey[0] === "ponte-nova"
    ? [{ versao: "0.3.52", plataforma: "macos", notas: "Correções" }] : state.abertas }),
}));
const device = { id: "d", sistema: "macos", versao_ponte: "0.3.51", ultimo_contato: new Date(now).toISOString() };
beforeEach(() => { state.abertas = 0; state.cmd = null; vi.clearAllMocks(); localStorage.clear(); });
describe("aviso da ponte", () => {
  it("Depois guarda a data e fecha o aviso", async () => {
    render(<AvisoPonteNova device={device} />);
    fireEvent.click(await screen.findByRole("button", { name: "Depois" }));
    expect(localStorage.getItem("fatiapro.ponte_depois.d.0.3.52")).toBe(String(now));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
  });
  it("não abre durante uma análise", async () => {
    state.abertas = 1;
    render(<AvisoPonteNova device={device} />);
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
  });
  it("envia o comando pelo botão", () => {
    render(<BotaoAtualizarPonte device={device} />);
    fireEvent.click(screen.getByRole("button", { name: "Atualizar agora" }));
    expect(state.enviar).toHaveBeenCalledTimes(1);
  });
  it("erro analise_aberta mostra a mensagem recebida no toast", () => {
    state.cmd = { id: "c", estado: "erro", resposta: { motivo: "analise_aberta", mensagem: "Termine sua análise primeiro" } };
    render(<BotaoAtualizarPonte device={device} />);
    expect(state.toast).toHaveBeenCalledWith("Termine sua análise primeiro");
  });
});