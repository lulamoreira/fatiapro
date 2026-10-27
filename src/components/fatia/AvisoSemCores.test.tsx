import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { AvisoSemCores, formatoSemCores } from "./AvisoSemCores";

describe("formatoSemCores", () => {
  it("escolher .stl mostra o aviso: detecta STL", () => {
    expect(formatoSemCores("jesus sentado.stl")).toBe("STL");
    expect(formatoSemCores("PECA.STL")).toBe("STL");
  });

  it("escolher .3mf não mostra o aviso: 3mf guarda cores", () => {
    expect(formatoSemCores("peca.3mf")).toBeNull();
  });

  it("trocar de .stl para .3mf faz o aviso sumir: extensão muda o resultado", () => {
    expect(formatoSemCores("peca.stl")).toBe("STL");
    expect(formatoSemCores("peca.3mf")).toBeNull();
  });

  it("detecta STEP em .step e .stp", () => {
    expect(formatoSemCores("peca.step")).toBe("STEP");
    expect(formatoSemCores("peca.stp")).toBe("STEP");
  });

  it("retorna null sem extensão ou com extensão desconhecida", () => {
    expect(formatoSemCores("peca")).toBeNull();
    expect(formatoSemCores("peca.obj")).toBeNull();
  });
});

describe("AvisoSemCores", () => {
  it("mostra título, texto do formato e botão Trocar arquivo", () => {
    render(<AvisoSemCores formato="STL" onTrocar={() => {}} />);
    expect(screen.getByText("Este arquivo não guarda cores")).toBeInTheDocument();
    expect(screen.getByText(/arquivo STL/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Trocar arquivo" })).toBeInTheDocument();
  });

  it("usa STEP no texto quando o formato é STEP", () => {
    render(<AvisoSemCores formato="STEP" onTrocar={() => {}} />);
    expect(screen.getByText(/arquivo STEP/)).toBeInTheDocument();
  });

  it("Trocar arquivo chama onTrocar (abre o seletor)", async () => {
    const onTrocar = vi.fn();
    render(<AvisoSemCores formato="STL" onTrocar={onTrocar} />);
    fireEvent.click(screen.getByRole("button", { name: "Trocar arquivo" }));
    expect(onTrocar).toHaveBeenCalledOnce();
  });

  it("sem formato (.3mf) não renderiza nada", () => {
    const { container } = render(<AvisoSemCores formato={null} onTrocar={() => {}} />);
    expect(container).toBeEmptyDOMElement();
  });
});
