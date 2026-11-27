import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

import type { ReactNode } from "react";

vi.mock("@tanstack/react-router", () => ({ Link: ({ children }: { children: ReactNode }) => <a href="/app/plano">{children}</a> }));
import { FaixaIA, etapaInfo, mmss } from "./PainelColorirIA";
import type { FaixaIAProps } from "./PainelColorirIA";

function ia(over: Partial<FaixaIAProps["ia"]> = {}): FaixaIAProps["ia"] {
  return {
    etapa: null, inicio: null, temRosto: true, pronta: false, erro: null, montagem: null, proposta: null,
    cancelar: vi.fn(async () => {}), descartar: vi.fn(), setSemRosto: vi.fn(), semRosto: false, limparErro: vi.fn(),
    ...over,
  } as FaixaIAProps["ia"];
}
const montagem = { avisos: ["Confira a boca"], paleta: [] } as unknown as FaixaIAProps["ia"]["montagem"];

describe("FaixaIA", () => {
  it("(a) mostra etapa, tempo e Cancelar durante o andamento", async () => {
    const x = ia({ etapa: "IA analisando as cores", inicio: Date.now() - 65000 });
    render(<FaixaIA ia={x} ocupado={false} onAplicar={() => {}} />);
    expect(screen.getByRole("status")).toHaveAttribute("aria-live", "polite");
    expect(screen.getByText("IA analisando as cores")).toBeInTheDocument();
    expect(screen.getByText("Etapa 2 de 4")).toBeInTheDocument();
    expect(screen.getByText("01:05")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Cancelar/ }));
    expect(x.cancelar).toHaveBeenCalled();
  });
  it("pula a etapa do rosto quando não há rosto", () => {
    expect(etapaInfo("Montando a prévia", false)).toMatchObject({ numero: 3, total: 3 });
    expect(etapaInfo("Preparando imagens", true).nome).toBe("Preparando imagens da peça");
    expect(mmss(125000)).toBe("02:05");
  });
  it("(b/d) prévia pronta mostra faixa verde com Aplicar, Só cores e Descartar", async () => {
    const onAplicar = vi.fn(), x = ia({ pronta: true, montagem, proposta: {} as FaixaIAProps["ia"]["proposta"] });
    render(<FaixaIA ia={x} ocupado={false} onAplicar={onAplicar} />);
    expect(screen.getByText("Prévia da IA pronta — nada foi alterado ainda")).toBeInTheDocument();
    expect(screen.getByText("Confira a boca")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Aplicar/ }));
    fireEvent.click(screen.getByRole("button", { name: /Descartar/ }));
    fireEvent.click(screen.getByRole("button", { name: /Só cores/ }));
    expect(onAplicar).toHaveBeenCalled();
    expect(x.descartar).toHaveBeenCalled();
    expect(x.setSemRosto).toHaveBeenCalledWith(true);
  });
  it("(d) some quando não há etapa, prévia nem erro", () => {
    const { container } = render(<FaixaIA ia={ia()} ocupado={false} onAplicar={() => {}} />);
    expect(container).toBeEmptyDOMElement();
  });
  it("(e) erro aparece na faixa com Ver planos", () => {
    render(<FaixaIA ia={ia({ erro: { codigo: "sem_creditos", mensagem: "Sem créditos." } })} ocupado={false} onAplicar={() => {}} />);
    expect(screen.getByRole("alert")).toHaveTextContent("Sem créditos.");
    expect(screen.getByText("Ver planos")).toBeInTheDocument();
  });
});
