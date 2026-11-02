import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AvisoPonteNova, BotaoAtualizarPonte, BotaoPonteSempre } from "./AtualizarPonte";

const state = vi.hoisted(() => ({ abertas: 0, enviar: vi.fn(), toast: vi.fn(),
  cmd: null as null | { id: string; estado: string; resposta: Record<string, unknown> } }));
const now = 2_000_000;
vi.mock("@/hooks/use-now", () => ({ useNow: () => now }));
vi.mock("@/components/fatia/EnviarComando", () => ({ useComando: () => ({ cmd: state.cmd, ocupado: false, enviar: state.enviar }) }));
vi.mock("sonner", () => ({ toast: { warning: state.toast, info: state.toast, success: state.toast, error: state.toast } }));
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
  it("Atualizar agora envia o comando e fecha a janela", async () => {
    render(<AvisoPonteNova device={device} />);
    fireEvent.click(await screen.findByRole("button", { name: "Atualizar agora" }));
    expect(state.enviar).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem("fatiapro.ponte_depois.d.0.3.52")).toBe(String(now));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
  });
  it("aviso concluído e erro apagam a marcação e avisam uma vez por comando", async () => {
    const { rerender } = render(<AvisoPonteNova device={device} />);
    fireEvent.click(await screen.findByRole("button", { name: "Atualizar agora" }));
    state.cmd = { id: "c1", estado: "erro", resposta: { motivo: "analise_aberta" } };
    rerender(<AvisoPonteNova device={device} />);
    await waitFor(() => expect(state.toast).toHaveBeenCalledWith("Há uma análise aberta neste computador. A ponte será atualizada depois."));
    expect(localStorage.getItem("fatiapro.ponte_depois.d.0.3.52")).toBeNull();
    state.cmd = { id: "c2", estado: "concluido", resposta: {} };
    rerender(<AvisoPonteNova device={device} />);
    await waitFor(() => expect(state.toast).toHaveBeenCalledWith("Ponte atualizada para a versão 0.3.52"));
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

describe("BotaoPonteSempre", () => {
  it("com versão nova, avisa e o clique envia o comando sem navegar", () => {
    const { container } = render(<BotaoPonteSempre device={device} />);
    expect(screen.getByText("Versão 0.3.52 disponível")).toBeInTheDocument();
    const botao = screen.getByRole("button", { name: "Atualizar ponte" });
    expect(botao).toBeEnabled();
    fireEvent.click(botao);
    expect(state.enviar).toHaveBeenCalledTimes(1);
    expect(container.querySelector("a")).toBeNull();
  });
  it("sem versão nova, mostra 'Versão mais recente' depois da consulta", () => {
    render(<BotaoPonteSempre device={{ ...device, versao_ponte: "0.3.52" }} />);
    expect(screen.getByText("Versão mais recente")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Atualizar ponte" })).toBeEnabled();
  });
  it("com o computador desconectado, desabilita e avisa", () => {
    render(<BotaoPonteSempre device={{ ...device, ultimo_contato: null }} />);
    expect(screen.getByText("Computador desconectado")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Atualizar ponte" })).toBeDisabled();
  });
  it("com versão sem botão, desabilita e explica a atualização sozinha", () => {
    render(<BotaoPonteSempre device={{ ...device, versao_ponte: "0.3.50" }} />);
    expect(screen.getByText("Ela entra sozinha quando não houver análise aberta")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Atualizar ponte" })).toBeDisabled();
  });
  it("ao concluir, mostra a mensagem recebida da ponte", () => {
    state.cmd = { id: "c", estado: "concluido", resposta: { mensagem: "Ponte atualizada para 0.3.52" } };
    render(<BotaoPonteSempre device={device} />);
    expect(screen.getByText("Ponte atualizada para 0.3.52")).toBeInTheDocument();
  });
});