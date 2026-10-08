/**
 * Montagem dos parâmetros da RPC `criar_analise`.
 * PostgREST remove chaves com valor `undefined` do JSON, o que muda a assinatura
 * procurada e causa PGRST202. Os 9 parâmetros SEMPRE vão na chamada; campos
 * opcionais vazios são enviados como null (nunca undefined).
 */
export interface CriarAnaliseEntrada {
  device_id: string;
  roteiro: "config_geral" | "reduzir_tempo" | "checklist" | "preco";
  fatiador: string | null;
  opcoes: Record<string, unknown>;
  motor: "fatiapro" | "api" | "assinatura";
  premium: boolean;
  arquivo_path: string | null;
  nome_peca: string | null;
}

export function parametrosCriarAnalise(p_user: string, d: CriarAnaliseEntrada) {
  return {
    p_user,
    p_device: d.device_id,
    p_roteiro: d.roteiro,
    p_fatiador: d.fatiador ?? null,
    p_opcoes: d.opcoes,
    p_motor: d.motor,
    p_premium: d.premium,
    p_arquivo_path: d.arquivo_path ?? null,
    p_nome_peca: d.nome_peca ?? null,
  };
}
