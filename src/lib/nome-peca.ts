/** Nome da peça: sanitização (vindo da ponte), extração de eventos antigos e exibição. */

export const NOME_PECA_PADRAO = "Peça aberta no fatiador";

/** Valida o `nome_peca` enviado pela ponte. Retorna null se inválido (ignorado em silêncio). */
export function sanitizarNomePeca(v: unknown): string | null {
  if (typeof v !== "string") return null;
  // eslint-disable-next-line no-control-regex
  const semControle = v.replace(/[\u0000-\u001f\u007f-\u009f]/g, "");
  const partes = semControle.split(/[\\/]/);
  const nome = (partes[partes.length - 1] ?? "").trim();
  if (nome.length < 1 || nome.length > 200) return null;
  return nome;
}

/** Só grava quando o job ainda não tem nome (nunca sobrescreve peça enviada pelo usuário). */
export function nomeParaGravar(atual: string | null | undefined, recebido: unknown): string | null {
  if (atual != null) return null;
  return sanitizarNomePeca(recebido);
}

/** Mesmo padrão usado na migração de recuperação. */
const RE_EVENTO = /Usando a peça aberta no [^:]+: (.+?) \(versão das/;

export function extrairNomeDoEvento(texto: unknown): string | null {
  if (typeof texto !== "string") return null;
  const m = RE_EVENTO.exec(texto);
  return m?.[1] ?? null;
}

/** Texto exibido: o nome real (inclusive "Projeto sem título"); padrão só sem nome. */
export function nomePecaExibicao(nome: string | null | undefined): string {
  const n = nome?.trim();
  return n ? n : NOME_PECA_PADRAO;
}
