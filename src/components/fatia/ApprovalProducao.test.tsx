import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { ApprovalProducao, type ItemProducao, type PropostaItemProducao, type PropostaProducao } from "./ApprovalProducao";

const prod = (over: Partial<ItemProducao> = {}): ItemProducao => ({
  por_placa: 12, segundos_placa: 7200, gramas_placa: 180, segundos_por_peca: 600,
  pecas_por_hora: 6, placas: 2, copias: 20, segundos_total: 13200,
  suporte: false, altura_mm: 40, balanco_pct: 5, medido: true, ...over,
});

const item = (id: string, pre: boolean, over: Partial<PropostaItemProducao> = {}): PropostaItemProducao => ({
  id, titulo: `Posição ${id}`, segundos_delta: -30, gramas: 15, impacto: "pequeno",
  pre_marcado: pre, grupo_exclusivo: "producao", rejeitado_motivo: null, producao: prod(), ...over,
});

const prop = (itens: PropostaItemProducao[], quantidade: number | null = 20): PropostaProducao => ({
  partida: { segundos: 630, gramas: 15.2 },
  itens,
  producao: { quantidade, mesa_mm: [256, 256] },
});

const renderA = (p: PropostaProducao, onAprovar = vi.fn()) => {
  render(<ApprovalProducao proposta={p} disabled={false} onAprovar={onAprovar} onPedirOutra={() => {}} onCancelar={() => {}} />);
  return onAprovar;
};

describe("ApprovalProducao", () => {
  it("abre com o item pré-marcado selecionado", () => {
    renderA(prop([item("a", false), item("b", true)]));
    const radios = screen.getAllByRole("radio");
    expect(radios[0]).toHaveAttribute("aria-checked", "false");
    expect(radios[1]).toHaveAttribute("aria-checked", "true");
  });

  it("selecionar outro desmarca o anterior (escolha única)", () => {
    renderA(prop([item("a", true), item("b", false)]));
    const radios = screen.getAllByRole("radio");
    fireEvent.click(radios[1]!);
    expect(screen.getAllByRole("radio")[0]).toHaveAttribute("aria-checked", "false");
    expect(screen.getAllByRole("radio")[1]).toHaveAttribute("aria-checked", "true");
  });

  it('"Gerar arquivo de produção" chama onAprovar com exatamente 1 id', () => {
    const onAprovar = renderA(prop([item("a", true), item("b", false)]));
    fireEvent.click(screen.getAllByRole("radio")[1]!);
    fireEvent.click(screen.getByRole("button", { name: "Gerar arquivo de produção" }));
    expect(onAprovar).toHaveBeenCalledWith(["b"]);
  });

  it('mostra "estimado" quando medido=false', () => {
    renderA(prop([item("a", true, { producao: prod({ medido: false }) })]));
    expect(screen.getByText("estimado")).toBeInTheDocument();
  });

  it('a linha "Para X peças" só aparece com quantidade', () => {
    const r = render(<ApprovalProducao proposta={prop([item("a", true)], 20)} disabled={false} onAprovar={() => {}} onPedirOutra={() => {}} onCancelar={() => {}} />);
    expect(screen.getByText(/Para 20 peças:/)).toBeInTheDocument();
    r.unmount();
    renderA(prop([item("a", true)], null));
    expect(screen.queryByText(/Para \d+ peças:/)).not.toBeInTheDocument();
  });
});

describe("suporte na aprovação da produção", () => {
  it("com suporte_g em partida e item mostra a tag, a nota e o delta", () => {
    const p = prop([item("a", true, { suporte_g: 12 })]);
    p.partida.suporte_g = 13.5;
    render(<ApprovalProducao proposta={p} disabled={false} onAprovar={() => {}} onPedirOutra={() => {}} onCancelar={() => {}} />);
    expect(screen.getByText("Suporte 12,0 g")).toBeInTheDocument();
    expect(screen.getByText("dos quais 13,5 g de suporte")).toBeInTheDocument();
    expect(screen.getByText("(−1,5 g)")).toBeInTheDocument();
  });

  it("sem suporte_g não mostra tag nem nota", () => {
    renderA(prop([item("a", true)]));
    expect(screen.queryByText(/Suporte \d/)).not.toBeInTheDocument();
    expect(screen.queryByText(/dos quais/)).not.toBeInTheDocument();
  });

  it("sem suporte_g mostra a linha de texto da ponte quando ela existe", () => {
    const p = prop([item("a", true, { producao: prod({ suporte_texto: "Suporte medido: 8,3 g" }) })]);
    renderA(p);
    expect(screen.getByText("Suporte medido: 8,3 g")).toBeInTheDocument();
  });

  it("com suporte_g a linha de texto da ponte dá lugar à tag", () => {
    const p = prop([item("a", true, { suporte_g: 12, producao: prod({ suporte_texto: "Suporte medido: 8,3 g" }) })]);
    p.partida.suporte_g = 13.5;
    renderA(p);
    expect(screen.getByText("Suporte 12,0 g")).toBeInTheDocument();
    expect(screen.queryByText("Suporte medido: 8,3 g")).not.toBeInTheDocument();
  });
});
