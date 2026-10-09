import { describe, it, expect, beforeAll, vi } from "vitest";
import { generateKeyPairSync, sign, createHash } from "node:crypto";
import { iniciarPublicacao, concluirPublicacao, mensagemPedido, type PonteDeps, type Pedido } from "./ponte-publicar";

let chave = "";
let priv: ReturnType<typeof generateKeyPairSync>["privateKey"];
const arquivo = new TextEncoder().encode("instalador de teste");
const sha = createHash("sha256").update(arquivo).digest("hex");
const AGORA = Date.parse("2026-10-09T12:00:00Z");
const assinar = (m: string) => sign(null, Buffer.from(m), priv).toString("base64");

beforeAll(() => {
  const kp = generateKeyPairSync("ed25519");
  priv = kp.privateKey;
  chave = kp.publicKey.export({ format: "der", type: "spki" }).toString("base64");
});

function pedido(over: Partial<Pedido> = {}): Pedido {
  const p: Pedido = {
    plataforma: "macos", versao: "1.3.0", nome_arquivo: "FatiaPro-Ponte.pkg", tamanho_bytes: arquivo.byteLength,
    sha256: sha, assinatura: assinar(sha), carimbo: new Date(AGORA).toISOString(), assinatura_pedido: "", ...over,
  };
  if (!over.assinatura_pedido) p.assinatura_pedido = assinar(mensagemPedido(p));
  return p;
}

function deps(conteudo: Uint8Array = arquivo, existentes = ["1.2.0"]) {
  const d = {
    versoesExistentes: vi.fn(async () => existentes),
    urlUpload: vi.fn(async (c: string) => `https://up/${c}`),
    baixar: vi.fn(async () => conteudo),
    apagar: vi.fn(async () => {}),
    inserir: vi.fn(async () => {}),
    auditar: vi.fn(async () => {}),
    agora: () => AGORA,
    chave,
  } satisfies PonteDeps;
  return d;
}

describe("publicação assinada da ponte", () => {
  it("aceita pedido válido", async () => {
    const r = await iniciarPublicacao(pedido(), deps());
    expect(r.status).toBe(200);
    expect(r.body["caminho"]).toBe("macos/1.3.0/FatiaPro-Ponte.pkg");
  });
  it("assinatura do arquivo errada → 401", async () => {
    const p = pedido({ assinatura: assinar("0".repeat(64)) });
    expect((await iniciarPublicacao(p, deps())).status).toBe(401);
    expect((await concluirPublicacao({ ...p, publicar: true }, deps())).status).toBe(401);
  });
  it("assinatura do pedido errada → 401", async () => {
    const p = pedido({ assinatura_pedido: assinar("publicar|macos|9.9.9|x|y") });
    expect((await iniciarPublicacao(p, deps())).status).toBe(401);
  });
  it("carimbo de 11 minutos → 401", async () => {
    const p = pedido({ carimbo: new Date(AGORA - 11 * 60_000).toISOString() });
    expect((await iniciarPublicacao(p, deps())).status).toBe(401);
  });
  it("versão igual ou menor → 409", async () => {
    expect((await iniciarPublicacao(pedido({ versao: "1.2.0" }), deps())).status).toBe(409);
    expect((await iniciarPublicacao(pedido({ versao: "1.1.9" }), deps())).status).toBe(409);
  });
  it("arquivo diferente → 422 e apaga o objeto", async () => {
    const outro = new TextEncoder().encode("instalador adulterado");
    const d = deps(outro);
    const r = await concluirPublicacao({ ...pedido(), publicar: true }, d);
    expect(r.status).toBe(422);
    expect(d.apagar).toHaveBeenCalledWith("macos/1.3.0/FatiaPro-Ponte.pkg");
    expect(d.inserir).not.toHaveBeenCalled();
  });
  it("concluir válido grava e audita", async () => {
    const d = deps();
    const r = await concluirPublicacao({ ...pedido(), publicar: false }, d);
    expect(r.body).toEqual({ ok: true, versao: "1.3.0", publicada: false });
    expect(d.auditar).toHaveBeenCalledWith({ versao: "1.3.0", plataforma: "macos", sha256: sha });
  });
});
