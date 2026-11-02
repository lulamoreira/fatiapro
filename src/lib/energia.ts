export const KWH_MEDIO_BRASIL = 1.14;
export const KWH_MEDIO_UF: Record<string, number> = {
  AC: 1.11, AL: 1.14, AM: 1.17, AP: 1.10, BA: 1.17, CE: 0.94, DF: 1.11,
  ES: 1.13, GO: 1.27, MA: 1.19, MG: 1.20, MS: 1.32, MT: 1.20, PA: 1.39,
  PB: 0.95, PE: 1.07, PI: 1.26, PR: 1.02, RJ: 1.29, RN: 1.03, RO: 1.02,
  RR: 1.05, RS: 1.18, SC: 1.01, SE: 1.01, SP: 1.06, TO: 1.32,
};

export function kwhEstimado(uf: string | null | undefined): { valor: number; origem: string } {
  if (uf && Object.hasOwn(KWH_MEDIO_UF, uf)) {
    return { valor: KWH_MEDIO_UF[uf], origem: `média de ${uf}` };
  }
  return { valor: KWH_MEDIO_BRASIL, origem: "média do Brasil" };
}