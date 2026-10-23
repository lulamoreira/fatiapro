import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { CustoReal, custoEmReais } from "./CustoReal";

describe("moeda do custo real", () => {
  it("converte o custo registrado sem alterá-lo", () => {
    expect(custoEmReais(0.0113, "5,50")).toBeCloseTo(0.06215, 8);
    expect(custoEmReais(2, "6.25")).toBe(12.5);
    expect(custoEmReais(0, "5,50")).toBe(0);
  });
  it("recusa câmbio vazio, inválido, zero ou negativo", () => {
    for (const cambio of ["", "abc", "0", "-1", "Infinity"]) expect(custoEmReais(1, cambio)).toBeNull();
  });
  it("abre em reais, permite dólar e usa o câmbio ajustado", () => {
    const custo = { usd: 0.0113 };
    render(<CustoReal motor="fatiapro" custo={custo} />);
    expect(screen.getByRole("radio", { name: "R$" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByText(/≈ R\$/).textContent).toContain("0,06");
    fireEvent.change(screen.getByLabelText("Câmbio R$/US$"), { target: { value: "10" } });
    expect(screen.getByText(/≈ R\$/).textContent).toContain("0,11");
    fireEvent.click(screen.getByRole("radio", { name: "US$" }));
    expect(screen.getByText(/US\$ 0,0113/)).toBeInTheDocument();
    expect(custo.usd).toBe(0.0113);
    fireEvent.click(screen.getByRole("radio", { name: "R$" }));
    expect(screen.getByLabelText("Câmbio R$/US$")).toHaveValue("10");
  });
  it("mantém uso do plano e não inventa custo ausente", () => {
    const { rerender } = render(<CustoReal motor="assinatura" custo={{ usd: 1 }} />);
    expect(screen.getByText("uso do plano")).toBeInTheDocument();
    expect(screen.queryByRole("radiogroup")).not.toBeInTheDocument();
    rerender(<CustoReal motor="fatiapro" custo={null} />);
    expect(screen.getByText("—")).toBeInTheDocument();
  });
});