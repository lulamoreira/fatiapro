/**
 * Signed (ed25519) automatic publishing of bridge installers.
 * Pure core: storage/DB are injected so tests can run with a test key pair.
 * Uses WebCrypto Ed25519 (works on Workers and Node).
 */
import { z } from "zod";
import { compararVersao, VERSAO_RE } from "./ponte";

export const CHAVE_PUBLICA_PONTE = "MCowBQYDK2VwAyEAYPPkymMoAYLpNm03LL0EPsUJ2+jBOuYfQrRvlCIHrEs=";
export const MAX_BYTES = 200 * 1024 * 1024;
export const JANELA_MS = 10 * 60 * 1000;

const b64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

/** Verifies an ed25519 signature (base64) over `mensagem` with an SPKI DER base64 public key. */
export async function verificarAssinatura(mensagem: string, assinaturaB64: string, chave = CHAVE_PUBLICA_PONTE): Promise<boolean> {
  try {
    const key = await crypto.subtle.importKey("spki", b64(chave), { name: "Ed25519" }, false, ["verify"]);
    return await crypto.subtle.verify({ name: "Ed25519" }, key, b64(assinaturaB64), new TextEncoder().encode(mensagem));
  } catch {
    return false;
  }
}

export const IniciarSchema = z.object({
  plataforma: z.enum(["macos", "windows"]),
  versao: z.string().regex(VERSAO_RE),
  nome_arquivo: z.string().min(5).max(200).regex(/^[A-Za-z0-9._ +()-]+$/),
  tamanho_bytes: z.number().int().min(1).max(MAX_BYTES),
  sha256: z.string().regex(/^[0-9a-f]{64}$/),
  assinatura: z.string().min(1).max(200),
  carimbo: z.string().min(1).max(40),
  assinatura_pedido: z.string().min(1).max(200),
}).refine((d) => d.nome_arquivo.toLowerCase().endsWith(d.plataforma === "macos" ? ".pkg" : ".exe"));
export const ConcluirSchema = z.object({ notas: z.string().max(500).optional(), publicar: z.boolean() });

export type Pedido = z.infer<typeof IniciarSchema>;
export const caminhoDe = (p: Pick<Pedido, "plataforma" | "versao" | "nome_arquivo">) => `${p.plataforma}/${p.versao}/${p.nome_arquivo}`;
export const mensagemPedido = (p: Pedido) => `publicar|${p.plataforma}|${p.versao}|${p.sha256}|${p.carimbo}`;

export interface PonteDeps {
  versoesExistentes(plataforma: string): Promise<string[]>;
  urlUpload(caminho: string): Promise<string>;
  baixar(caminho: string): Promise<Uint8Array | null>;
  apagar(caminho: string): Promise<void>;
  inserir(row: Record<string, unknown>): Promise<void>;
  auditar(detalhe: Record<string, unknown>): Promise<void>;
  agora?: () => number;
  chave?: string;
}

export type Resultado = { status: number; body: Record<string, unknown> };
const falha = (status: number, erro: string, mensagem: string): Resultado => ({ status, body: { erro, mensagem } });

async function validar(raw: unknown, deps: PonteDeps): Promise<{ p: Pedido } | Resultado> {
  const parsed = IniciarSchema.safeParse(raw);
  if (!parsed.success) return falha(400, "dados_invalidos", "Dados inválidos.");
  const p = parsed.data;
  const t = Date.parse(p.carimbo);
  const agora = (deps.agora ?? Date.now)();
  if (!/^\d{4}-\d\d-\d\dT.*(Z|[+-]00:?00)$/.test(p.carimbo) || Number.isNaN(t) || Math.abs(agora - t) > JANELA_MS)
    return falha(401, "assinatura_invalida", "Assinatura inválida.");
  const okArq = await verificarAssinatura(p.sha256, p.assinatura, deps.chave);
  const okPed = okArq && (await verificarAssinatura(mensagemPedido(p), p.assinatura_pedido, deps.chave));
  if (!okArq || !okPed) return falha(401, "assinatura_invalida", "Assinatura inválida.");
  const existentes = await deps.versoesExistentes(p.plataforma);
  if (existentes.some((v) => compararVersao(p.versao, v) <= 0)) return falha(409, "versao_nao_e_maior", "A versão precisa ser maior que as existentes.");
  return { p };
}

export async function iniciarPublicacao(raw: unknown, deps: PonteDeps): Promise<Resultado> {
  const v = await validar(raw, deps);
  if (!("p" in v)) return v;
  const caminho = caminhoDe(v.p);
  return { status: 200, body: { caminho, url_upload: await deps.urlUpload(caminho) } };
}

async function sha256Hex(buf: Uint8Array): Promise<string> {
  const d = await crypto.subtle.digest("SHA-256", buf as Uint8Array<ArrayBuffer>);
  return Array.from(new Uint8Array(d), (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function concluirPublicacao(raw: unknown, deps: PonteDeps): Promise<Resultado> {
  const extra = ConcluirSchema.safeParse(raw);
  if (!extra.success) return falha(400, "dados_invalidos", "Dados inválidos.");
  const v = await validar(raw, deps);
  if (!("p" in v)) return v;
  const p = v.p;
  const caminho = caminhoDe(p);
  const arq = await deps.baixar(caminho);
  if (!arq || arq.byteLength !== p.tamanho_bytes || (await sha256Hex(arq)) !== p.sha256) {
    if (arq) await deps.apagar(caminho);
    return falha(422, "arquivo_nao_confere", "O arquivo enviado não confere.");
  }
  const notas = extra.data.notas?.trim() || null;
  await deps.inserir({
    plataforma: p.plataforma, versao: p.versao, arquivo_path: caminho, nome_arquivo: p.nome_arquivo,
    tamanho_bytes: p.tamanho_bytes, sha256: p.sha256, assinatura: p.assinatura, notas,
    publicada: extra.data.publicar, publicada_por_assinatura: true,
  });
  // A versão já está gravada: falha na auditoria não pode virar 500.
  try {
    await deps.auditar({ versao: p.versao, plataforma: p.plataforma, sha256: p.sha256 });
  } catch (e) {
    console.error("[ponte-publicar] auditoria falhou", e instanceof Error ? e.message : "erro");
    return { status: 200, body: { ok: true, versao: p.versao, publicada: extra.data.publicar, auditoria: false } };
  }
  return { status: 200, body: { ok: true, versao: p.versao, publicada: extra.data.publicar } };
}
