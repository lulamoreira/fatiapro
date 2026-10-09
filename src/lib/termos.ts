/** Única fonte da versão dos Termos/Privacidade. Trocar aqui pede novo aceite a todos. */
export const TERMOS_VERSAO = "1.0";
export const TERMOS_DATA = "09/10/2026";

/** true quando o perfil não tem aceite da versão atual. */
export function precisaAceitarTermos(versaoAceita: string | null | undefined, atual: string = TERMOS_VERSAO): boolean {
  return !versaoAceita || versaoAceita !== atual;
}
