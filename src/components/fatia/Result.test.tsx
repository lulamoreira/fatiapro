import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Result, type ResultadoConteudo } from "./Result";

const AVISO =
  "Tempo e filamento estimados: a peça é muito detalhada para fatiar a placa cheia de uma vez. O arquivo vai pronto para o fatiador, mas sem fatiar — ao abrir, clique em Fatiar para ver o tempo exato.";

const conteudo = (producao: ResultadoConteudo["producao"]): ResultadoConteudo => ({
  final: { segundos: 7200, gramas: 300 },
  producao,
});

describe("Result — produção em lote estimada", () => {
  it("mostra a tag 'estimado' e o aviso quando estimado=true", () => {
    render(<Result c={conteudo({ copias: 20, placas: 2, estimado: true })} motor="api" custo={null} />);
    expect(screen.getByText("Arquivo de produção pronto")).toBeInTheDocument();
    expect(screen.getByText("estimado")).toBeInTheDocument();
    expect(screen.getByRole("note")).toHaveTextContent(AVISO);
  });

  it("não mostra tag nem aviso quando o campo vem como false", () => {
    render(<Result c={conteudo({ copias: 20, placas: 2, estimado: false })} motor="api" custo={null} />);
    expect(screen.queryByText("estimado")).not.toBeInTheDocument();
    expect(screen.queryByRole("note")).not.toBeInTheDocument();
  });

  it("não mostra tag nem aviso quando o campo está ausente", () => {
    render(<Result c={conteudo({ copias: 20, placas: 2 })} motor="api" custo={null} />);
    expect(screen.queryByText("estimado")).not.toBeInTheDocument();
    expect(screen.queryByRole("note")).not.toBeInTheDocument();
  });
});
