/**
 * Coupons — pure rules (deps injected). All validation of the coupon itself
 * happens in SQL resgatar_cupom (service_role only, row lock on the coupon).
 */
import { z } from "zod";

export const MAX_TENTATIVAS_ERRADAS_HORA = 10;
export const CODIGO_RE = /^[A-Z0-9-]{3,30}$/;

export const normalizarCodigo = (c: string) => c.trim().toUpperCase();

export const CodigoInput = z.object({ codigo: z.string().max(60) }).strip();

export const ERROS_CUPOM: Record<string, string> = {
  cupom_invalido: "Cupom inválido.",
  cupom_expirado: "Este cupom está fora do período de validade.",
  cupom_esgotado: "Este cupom já atingiu o limite de usos.",
  cupom_ja_usado: "Você já usou este cupom.",
  cupom_so_primeira_compra: "Este cupom vale só para quem ainda não fez nenhuma compra.",
};
export const MSG_MUITAS_TENTATIVAS = "Muitas tentativas, tente mais tarde.";

export function codigoErroCupom(mensagem: string | undefined | null): string {
  const m = mensagem ?? "";
  return Object.keys(ERROS_CUPOM).find((k) => m.includes(k)) ?? "cupom_invalido";
}

export interface CupomDeps {
  tentativasErradasUltimaHora(userId: string): Promise<number>;
  registrarTentativaErrada(userId: string): Promise<void>;
  resgatar(userId: string, codigo: string): Promise<{ ok: true; creditos: number; expira_em: string } | { ok: false; erro: string }>;
}

export type ResultadoCupom = { ok: true; creditos: number; expira_em: string } | { ok: false; mensagem: string };

export async function resgatarCupomLogica(userId: string, codigoBruto: string, deps: CupomDeps): Promise<ResultadoCupom> {
  if ((await deps.tentativasErradasUltimaHora(userId)) >= MAX_TENTATIVAS_ERRADAS_HORA) return { ok: false, mensagem: MSG_MUITAS_TENTATIVAS };
  const codigo = normalizarCodigo(codigoBruto);
  if (!CODIGO_RE.test(codigo)) {
    await deps.registrarTentativaErrada(userId);
    return { ok: false, mensagem: ERROS_CUPOM["cupom_invalido"]! };
  }
  const r = await deps.resgatar(userId, codigo);
  if (r.ok) return r;
  await deps.registrarTentativaErrada(userId);
  return { ok: false, mensagem: ERROS_CUPOM[r.erro] ?? ERROS_CUPOM["cupom_invalido"]! };
}

/** DD/MM/AAAA in Brasília time. */
export const dataBR = (iso: string) => new Date(iso).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
