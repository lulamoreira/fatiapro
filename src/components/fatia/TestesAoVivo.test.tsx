import { describe, expect, it } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { BlocoTestesAoVivo, TestesAoVivo } from "./TestesAoVivo";
import type { GrupoTestes } from "@/lib/progresso-analise";

const grupos: GrupoTestes[] = [{ grupo: "Posições", testes: [
  { id: "original", titulo: "Original", estado: "pronto", atual: true, segundos: 600, gramas: 20, suporte_g: 5 },
  { id: "melhor", titulo: "Deitada", estado: "escolhido", segundos: 480, gramas: 18, suporte_g: 3 },
  { id: "maior", titulo: "Em pé", estado: "pronto", segundos: 720, suporte_g: 7 },
] }];

describe("TestesAoVivo", () => {
  it("não renderiza quando não há testes", () => {
    const { container, rerender } = render(<TestesAoVivo grupos={[]} />);
    expect(container).toBeEmptyDOMElement();
    rerender(<TestesAoVivo grupos={[{ grupo: "Vazio", testes: [] }]} />);
    expect(container).toBeEmptyDOMElement();
  });
  it("exibe o estado escolhido e medições", () => {
    render(<TestesAoVivo grupos={grupos} />);
    const card = within(screen.getByRole("article", { name: "Deitada" }));
    expect(card.getByText("Escolhido")).toBeInTheDocument();
    expect(card.getByText("18,0 g")).toBeInTheDocument();
    expect(card.getByText("suporte 3,0 g")).toBeInTheDocument();
  });
  it("compara tempo e suporte apenas com a peça atual do mesmo grupo", () => {
    render(<TestesAoVivo grupos={[...grupos, { grupo: "Sem referência", testes: [{ id: "outro", estado: "pronto", segundos: 100, suporte_g: 1 }] }]} />);
    const melhor = within(screen.getByRole("article", { name: "Deitada" }));
    expect(melhor.getByText("Tempo: −2m 00s")).toBeInTheDocument();
    expect(melhor.getByText("Suporte: −2,0 g")).toBeInTheDocument();
    const maior = within(screen.getByRole("article", { name: "Em pé" }));
    expect(maior.getByText("Tempo: +2m 00s")).toBeInTheDocument();
    expect(maior.getByText("Suporte: +2,0 g")).toBeInTheDocument();
    expect(within(screen.getByRole("article", { name: "Original" })).queryByLabelText("Comparação com a peça como veio")).not.toBeInTheDocument();
    expect(within(screen.getByRole("article", { name: "outro" })).queryByLabelText("Comparação com a peça como veio")).not.toBeInTheDocument();
  });
  it("mostra imagem e falha enviada pela ponte", () => {
    render(<TestesAoVivo grupos={[{ grupo: "Ajustes", testes: [{ id: "a", titulo: "Teste com erro", estado: "falhou", erro: "Não foi possível fatiar", imagem: "data:image/png;base64,AAAA" }] }]} />);
    expect(screen.getByRole("img", { name: "Teste com erro" })).toBeInTheDocument();
    expect(screen.getByText("Falhou")).toBeInTheDocument();
    expect(screen.getByText("Não foi possível fatiar")).toBeInTheDocument();
  });
  it("abre durante a análise, fecha ao terminar e permite reabrir", () => {
    const { rerender } = render(<BlocoTestesAoVivo grupos={grupos} emAndamento />);
    expect(screen.getByRole("button", { name: "Testes feitos (3)" })).toHaveAttribute("aria-expanded", "true");
    rerender(<BlocoTestesAoVivo grupos={grupos} emAndamento={false} />);
    const botao = screen.getByRole("button", { name: "Testes feitos (3)" });
    expect(botao).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("Escolhido")).not.toBeInTheDocument();
    fireEvent.click(botao);
    expect(screen.getByText("Escolhido")).toBeInTheDocument();
  });
});