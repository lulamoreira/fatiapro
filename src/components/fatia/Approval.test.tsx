import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Approval, totaisMarcados, type Proposta, type PropostaItem } from "./Approval";

const item = (id: string, gramas: number, pre = true): PropostaItem => ({
  id, titulo: `Item ${id}`, segundos_delta: -60, gramas, impacto: null, pre_marcado: pre, grupo_exclusivo: null, rejeitado_motivo: null,
});
const prop = (itens: PropostaItem[]): Proposta => ({ partida: { segundos: 3600, gramas: 157.3 }, itens });

describe("peso na aprovação", () => {
  it("um item de 156,1 g sobre partida de 157,3 g dá 156,1 g (economia 1,2 g)", () => {
    const p = prop([item("a", 156.1)]);
    expect(totaisMarcados(p, new Set(["a"])).gr).toBeCloseTo(156.1, 5);
    render(<Approval proposta={p} disabled={false} onAprovar={() => {}} onPedirOutra={() => {}} onCancelar={() => {}} />);
    expect(screen.getByText("Com o que você marcou").parentElement?.textContent).toContain("156,1");
    expect(screen.getByText("Economia estimada").parentElement?.textContent).toContain("1,2");
  });
  it("dois itens (-1,2 g e -2,6 g) dão 153,5 g", () => {
    const p = prop([item("a", 156.1), item("b", 154.7)]);
    expect(totaisMarcados(p, new Set(["a", "b"])).gr).toBeCloseTo(153.5, 5);
  });
});
