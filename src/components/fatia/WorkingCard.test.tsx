import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { WorkingCard, type WorkingCardProps } from "./WorkingCard";

const props: WorkingCardProps = {
  fase: "analisando", ultimaMensagem: "Fatiando", desdeMs: 0, now: 1000,
  ultimoContatoMs: 1000, semEventosMs: 0, onCancelar: vi.fn(),
};

describe("WorkingCard percentual", () => {
  it("mostra progresso determinado e nunca recua dentro da mesma fase", () => {
    const r = render(<WorkingCard {...props} percentual={36} />);
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "36");
    expect(screen.getByText("36%")).toBeInTheDocument();
    r.rerender(<WorkingCard {...props} percentual={30} />);
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "36");
    r.rerender(<WorkingCard {...props} percentual={60} />);
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "60");
  });
  it("sem percentual mantém a mensagem indeterminada", () => {
    render(<WorkingCard {...props} />);
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
    expect(screen.getByText("Fatiando")).toBeInTheDocument();
  });
  it("uma nova fase reinicia a barra", () => {
    const r = render(<WorkingCard key="analise" {...props} percentual={90} />);
    r.rerender(<WorkingCard key="aplicacao" {...props} fase="aplicando" percentual={3} />);
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "3");
  });
});