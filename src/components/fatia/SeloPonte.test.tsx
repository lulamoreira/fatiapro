import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { SeloPonte } from "./SeloPonte";

describe("SeloPonte", () => {
  it("com versão mostra 'Ponte <versão>'", () => {
    render(<SeloPonte versao="0.3.49" nome="PC da oficina" />);
    expect(screen.getByText("Ponte 0.3.49")).toBeInTheDocument();
    const selo = screen.getByLabelText("Versão da ponte no computador PC da oficina");
    expect(selo.getAttribute("title")).toBe("Versão da ponte no computador PC da oficina");
  });

  it("sem versão não mostra nada", () => {
    const { container } = render(<SeloPonte versao={null} nome="PC" />);
    expect(container).toBeEmptyDOMElement();
  });

  it("sem versão nem nome, não mostra nada", () => {
    const { container } = render(<SeloPonte />);
    expect(container).toBeEmptyDOMElement();
  });

  it("sem nome, o rótulo de acessibilidade não menciona computador com nome", () => {
    render(<SeloPonte versao="1.0" />);
    expect(screen.getByLabelText("Versão da ponte no computador")).toBeInTheDocument();
  });
});
