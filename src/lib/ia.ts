/** Pure helpers for the bridge AI proxy (testable, no secrets). */
export const MODELO_IA = { padrao: "claude-sonnet-5-5", premium: "claude-opus-5-5" } as const;
export const MAX_CHAMADAS_POR_JOB = 8;

export interface UsoIA { input_tokens?: number; output_tokens?: number; cache_read_input_tokens?: number; cache_creation_input_tokens?: number }

/** (in×pIn + out×pOut + cacheRead×0,20 + cacheWrite×pIn×1,25) / 1e6 — formula given by the owner. */
export function custoChamadaUSD(u: UsoIA, precoEntrada: number, precoSaida: number): number {
  const i = u.input_tokens ?? 0, o = u.output_tokens ?? 0, cr = u.cache_read_input_tokens ?? 0, cw = u.cache_creation_input_tokens ?? 0;
  return (i * precoEntrada + o * precoSaida + cr * 0.2 + cw * precoEntrada * 1.25) / 1_000_000;
}
