import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FraseAnimo } from "./FraseAnimo";
import { criarSequenciaAnimo, FRASES_ANIMO, podeMostrarAnimo } from "@/lib/frases-animo";

describe("frases de ânimo", () => {
  beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(0); });
  afterEach(() => { cleanup(); vi.useRealTimers(); });
  const avancar = (ms: number) => act(() => { vi.advanceTimersByTime(ms); });
  const fraseVisivel = () => FRASES_ANIMO.find((frase) => screen.queryByText(frase));

  it("não mostra antes de 20 s e começa aos 20 s", () => {
    render(<FraseAnimo ativa inicioMs={0} />);
    avancar(19_999);
    expect(fraseVisivel()).toBeUndefined();
    avancar(1);
    expect(fraseVisivel()).toBeDefined();
  });

  it("troca somente a cada 30 s", () => {
    render(<FraseAnimo ativa inicioMs={0} />);
    avancar(20_000);
    const primeira = fraseVisivel();
    avancar(29_999);
    expect(fraseVisivel()).toBe(primeira);
    avancar(1);
    const segunda = fraseVisivel();
    expect(segunda).toBeDefined();
    expect(segunda).not.toBe(primeira);
    avancar(30_000);
    expect(fraseVisivel()).not.toBe(segunda);
  });

  it("usa as dez antes de reembaralhar e não repete nas fronteiras dos ciclos", () => {
    const proxima = criarSequenciaAnimo(() => 0.999);
    const frases = Array.from({ length: 40 }, () => proxima());
    for (let i = 0; i < frases.length; i += 10) {
      expect(new Set(frases.slice(i, i + 10)).size).toBe(10);
    }
    for (let i = 1; i < frases.length; i++) expect(frases[i]).not.toBe(frases[i - 1]);
  });

  it("evita repetir quando o embaralhamento começaria com a última frase anterior", () => {
    let chamadas = 0;
    const proxima = criarSequenciaAnimo(() => chamadas++ < 9 ? 0.999 : 0);
    const frases = Array.from({ length: 20 }, () => proxima());
    expect(frases[10]).not.toBe(frases[9]);
    expect(new Set(frases.slice(10)).size).toBe(10);
  });

  it("some ao chegar a proposta, mesmo com estado ainda analisando", () => {
    const { rerender } = render(<FraseAnimo ativa={podeMostrarAnimo("analisando", false)} inicioMs={0} />);
    avancar(20_000);
    expect(fraseVisivel()).toBeDefined();
    rerender(<FraseAnimo ativa={podeMostrarAnimo("analisando", true)} inicioMs={0} />);
    expect(fraseVisivel()).toBeUndefined();
    avancar(60_000);
    expect(fraseVisivel()).toBeUndefined();
  });

  it.each(["na_fila", "analisando", "aplicando"])("permite frases em %s sem interrupção", (estado) => {
    expect(podeMostrarAnimo(estado, false)).toBe(true);
    expect(podeMostrarAnimo(estado, true)).toBe(false);
  });

  it.each(["aguardando_aprovacao", "concluido", "erro", "cancelado", "limite_de_gasto"])("não mostra em %s", (estado) => {
    expect(podeMostrarAnimo(estado, false)).toBe(false);
  });
});