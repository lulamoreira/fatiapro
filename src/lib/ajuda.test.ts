import { describe, it, expect } from "vitest";
import { existsSync } from "node:fs";
import path from "node:path";
import { AJUDA_DA_TELA, ARTIGOS_AJUDA, CATEGORIAS_AJUDA, artigoPorSlug, buscarArtigos, lerBuscaAjuda } from "./ajuda";

const IMAGENS = ["como-funciona.webp", "inicio.webp", "baixar-ponte.webp", "conectar-computador.webp", "computador-conectado.webp", "celular.webp", "nova-analise-roteiro.webp", "nova-analise-impressora.webp", "analise-andamento.webp", "analise-resultado.webp", "historico.webp", "plano-creditos.webp", "comprar-creditos.webp", "preco-resultado.webp", "meu-negocio.webp", "orcamento-formulario.webp", "orcamento-pdf.webp"];

describe("busca da ajuda", () => {
  it("acha por palavra sem acento", () => {
    expect(buscarArtigos("credito").map((a) => a.slug)).toContain("o-que-e-credito");
    expect(buscarArtigos("orcamento").map((a) => a.slug)).toContain("gerar-orcamento");
  });
  it("não diferencia maiúsculas", () => {
    expect(buscarArtigos("MERCADO PAGO").map((a) => a.slug)).toContain("comprar-creditos");
  });
  it("busca vazia devolve tudo", () => expect(buscarArtigos("  ")).toHaveLength(ARTIGOS_AJUDA.length));
});

describe("?artigo=", () => {
  it("abre o artigo certo", () => expect(lerBuscaAjuda({ artigo: "conectar-computador" })).toEqual({ artigo: "conectar-computador" }));
  it("ignora slug inexistente", () => expect(lerBuscaAjuda({ artigo: "nao-existe" })).toEqual({}));
});

describe("catálogo", () => {
  it("todo slug dos botões ? existe", () => {
    for (const s of Object.values(AJUDA_DA_TELA)) expect(artigoPorSlug(s), s).toBeDefined();
  });
  it("toda imagem existe em /public/ajuda e está na lista", () => {
    for (const a of ARTIGOS_AJUDA) if (a.imagem) {
      const arq = a.imagem.src.replace("/ajuda/", "");
      expect(IMAGENS, a.slug).toContain(arq);
      expect(existsSync(path.resolve("public/ajuda", arq)), arq).toBe(true);
    }
  });
  it("slugs únicos, categorias e relacionados válidos", () => {
    expect(new Set(ARTIGOS_AJUDA.map((a) => a.slug)).size).toBe(ARTIGOS_AJUDA.length);
    const cats = new Set(CATEGORIAS_AJUDA.map((c) => c.id));
    for (const a of ARTIGOS_AJUDA) {
      expect(cats.has(a.categoria), a.slug).toBe(true);
      for (const r of a.relacionados ?? []) expect(artigoPorSlug(r), `${a.slug}→${r}`).toBeDefined();
    }
  });
});
