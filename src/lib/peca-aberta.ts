export interface AvisoPecaAberta {
  fatiador: string;
  atalho: string;
}

export function avisoPecaAberta(usarAberta: boolean, fatiador: string | null | undefined, sistema: string | null | undefined): AvisoPecaAberta | null {
  if (!usarAberta) return null;
  return {
    fatiador: fatiador?.trim() || "fatiador",
    atalho: sistema === "macos" ? "⌘S" : sistema === "windows" ? "Ctrl+S" : "⌘S no Mac, Ctrl+S no Windows",
  };
}

export function separarVersaoPecaAberta(texto: string): { antes: string; versao: string; depois: string } | null {
  if (!texto.startsWith("Usando a peça aberta")) return null;
  const match = /\(versão das (?:[01]\d|2[0-3]):[0-5]\d\)/.exec(texto);
  if (!match) return null;
  return { antes: texto.slice(0, match.index), versao: match[0], depois: texto.slice(match.index + match[0].length) };
}