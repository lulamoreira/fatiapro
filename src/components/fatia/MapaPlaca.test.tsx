import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MapaPlaca, pontosDaPeca, type MapaPlacaDados } from "./MapaPlaca";

const mapa: MapaPlacaDados = {
  mesa: [0, 0, 256, 256], forma: [[0, 0], [10, 0], [10, 10], [0, 10]],
  pecas: [[20, 30, 0], [50, 60, 90]],
};

describe("MapaPlaca", () => {
  it("desenha exatamente uma peça por coordenada recebida", () => {
    render(<MapaPlaca mapa={mapa} />);
    expect(screen.getByRole("img").querySelectorAll("polygon")).toHaveLength(2);
    expect(screen.getByRole("img")).toHaveAttribute("aria-label", "Placa 1 vista de cima · 2 peças");
    expect(screen.queryByLabelText("Torre")).not.toBeInTheDocument();
  });
  it("desenha a torre incluindo a borda e invertendo Y", () => {
    render(<MapaPlaca mapa={{ ...mapa, torre: { x: 100, y: 120, largura: 20, profundidade: 30, borda: 5 } }} />);
    const rect = screen.getByLabelText("Torre").querySelector("rect");
    expect(rect).toHaveAttribute("x", "95");
    expect(rect).toHaveAttribute("y", "-155");
    expect(rect).toHaveAttribute("width", "30");
    expect(rect).toHaveAttribute("height", "40");
  });
  it("gira o quadrado 90 graus antes de deslocar e inverter Y", () => {
    expect(pontosDaPeca(mapa.forma, [50, 60, 90])).toBe("50,-60 50,-70 40,-70 40,-60");
    render(<MapaPlaca mapa={mapa} />);
    expect(screen.getByRole("img").querySelectorAll("polygon")[1]).toHaveAttribute("points", "50,-60 50,-70 40,-70 40,-60");
  });
  it("ignora mapa inválido sem quebrar a tela", () => {
    render(<MapaPlaca mapa={{ ...mapa, mesa: [0, 0, 0, 0] }} />);
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });
});