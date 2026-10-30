import { afterEach, describe, expect, it, vi } from "vitest";
import { escolherImagem, leitorDeUrl, lerDiretorio, type Entrada } from "@/lib/miniatura-3mf";

/** Monta uma entrada de diretório central de zip em memória. */
function entradaDir(nome: string, opts: Partial<Entrada> = {}): Uint8Array {
  const nomeBytes = new TextEncoder().encode(nome);
  const b = new Uint8Array(46 + nomeBytes.length);
  const v = new DataView(b.buffer);
  v.setUint32(0, 0x02014b50, true);
  v.setUint16(10, opts.metodo ?? 0, true);
  v.setUint32(20, opts.tamanhoComprimido ?? 100, true);
  v.setUint32(24, opts.tamanhoReal ?? 200, true);
  v.setUint16(28, nomeBytes.length, true);
  v.setUint32(42, opts.offset ?? 0, true);
  b.set(nomeBytes, 46);
  return b;
}

const ent = (nome: string, tamanhoReal = 200): Entrada => ({ nome, metodo: 0, tamanhoComprimido: 100, tamanhoReal, offset: 0 });

describe("lerDiretorio", () => {
  it("lê as entradas do diretório central", () => {
    const dir = new Uint8Array([...entradaDir("Metadata/plate_1.png", { offset: 7 }), ...entradaDir("3D/3dmodel.model", { tamanhoReal: 999 })]);
    const entradas = lerDiretorio(dir);
    expect(entradas).toHaveLength(2);
    expect(entradas[0]).toMatchObject({ nome: "Metadata/plate_1.png", metodo: 0, tamanhoComprimido: 100, tamanhoReal: 200, offset: 7 });
    expect(entradas[1]).toMatchObject({ nome: "3D/3dmodel.model", tamanhoReal: 999 });
  });

  it("devolve vazio quando não há assinatura de diretório", () => {
    expect(lerDiretorio(new Uint8Array(100))).toEqual([]);
  });
});

describe("escolherImagem", () => {
  it("com vários top_N escolhe o plate_N do maior top", () => {
    const entradas = [ent("Metadata/top_1.png", 100), ent("Metadata/top_2.png", 500), ent("Metadata/plate_1.png"), ent("Metadata/plate_2.png")];
    expect(escolherImagem(entradas)?.nome).toBe("Metadata/plate_2.png");
  });

  it("sem top usa plate_1", () => {
    expect(escolherImagem([ent("Metadata/plate_1.png")])?.nome).toBe("Metadata/plate_1.png");
  });

  it("sem plate usa thumbnail_middle", () => {
    expect(escolherImagem([ent("Auxiliaries/.thumbnails/thumbnail_middle.png")])?.nome).toBe("Auxiliaries/.thumbnails/thumbnail_middle.png");
  });

  it("sem imagem devolve null", () => {
    expect(escolherImagem([ent("3D/3dmodel.model")])).toBeNull();
  });
});

describe("leitorDeUrl", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("com resposta 206 devolve os bytes da faixa", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(new Uint8Array([1, 2, 3]), { status: 206 }));
    vi.stubGlobal("fetch", fetchMock);
    const ler = leitorDeUrl("https://x/peca.3mf");
    expect([...(await ler(10, 12))]).toEqual([1, 2, 3]);
    expect(fetchMock).toHaveBeenCalledWith("https://x/peca.3mf", { headers: { Range: "bytes=10-12" } });
  });

  it("com resposta 200 guarda o arquivo inteiro e atende as próximas faixas sem baixar de novo", async () => {
    const inteiro = new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    const fetchMock = vi.fn().mockResolvedValue(new Response(inteiro, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const ler = leitorDeUrl("https://x/peca.3mf");
    expect([...(await ler(0, 3))]).toEqual([0, 1, 2, 3]);
    expect([...(await ler(4, 6))]).toEqual([4, 5, 6]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("status de erro lança exceção", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 403 })));
    await expect(leitorDeUrl("https://x/peca.3mf")(0, 9)).rejects.toThrow("403");
  });
});
