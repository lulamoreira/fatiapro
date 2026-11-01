import { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FilamentoMisto } from "./FilamentoMisto";
import { FORM_INICIAL } from "./form";
import type { Cor3mf } from "@/lib/cores-3mf";

function Tela({ cores = null }: { cores?: Cor3mf[] | null }) {
  const [form, setForm] = useState(FORM_INICIAL);
  return <><FilamentoMisto form={form} cores={cores} onChange={(v) => setForm((p) => ({ ...p, ...v }))} /><output aria-label="Seleção">{JSON.stringify({ tem: form.filMisto, tipos: form.filMistoTipos, cores: form.filMistoCores })}</output></>;
}
describe("FilamentoMisto", () => {
  it("sem seleção inicial; Sim permite chips e Não limpa", () => {
    render(<Tela />);
    expect(screen.getByLabelText("Seleção").textContent).toBe('{"tem":null,"tipos":[],"cores":[]}');
    fireEvent.click(screen.getByRole("radio", { name: "Sim" }));
    fireEvent.click(screen.getByRole("button", { name: "PLA Silk" }));
    expect(screen.getByLabelText("Seleção").textContent).toBe('{"tem":true,"tipos":["PLA Silk"],"cores":[]}');
    fireEvent.click(screen.getByRole("radio", { name: "Não" }));
    expect(screen.getByLabelText("Seleção").textContent).toBe('{"tem":false,"tipos":[],"cores":[]}');
  });
  it("Sim grava todas as cores com os tipos dos perfis", () => {
    render(<Tela cores={[{ slot: 1, cor: "#ff0000", perfil: "PLA SILK" }, { slot: 2, cor: "#ffffff", perfil: "PETG" }]} />);
    fireEvent.click(screen.getByRole("radio", { name: "Sim" }));
    expect(screen.getByLabelText("Seleção").textContent).toBe('{"tem":true,"tipos":[],"cores":[{"slot":1,"tipo":"PLA Silk"},{"slot":2,"tipo":"PETG"}]}');
    expect(screen.getAllByRole("combobox")).toHaveLength(2);
    fireEvent.click(screen.getByRole("radio", { name: "Não" }));
    expect(screen.getByLabelText("Seleção").textContent).toBe('{"tem":false,"tipos":[],"cores":[]}');
  });
});