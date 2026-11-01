/** Adds separators only when another group has started. */
function agrupar(digitos: string, tamanhos: readonly number[], separadores: readonly string[]): string {
  let inicio = 0;
  return tamanhos.map((tamanho, i) => {
    const grupo = digitos.slice(inicio, inicio + tamanho);
    inicio += tamanho;
    return grupo ? `${i === 0 ? "" : separadores[i - 1] ?? ""}${grupo}` : "";
  }).join("");
}

export function formatarDocumento(v: string): string {
  const d = v.replace(/\D/g, "").slice(0, 14);
  return d.length <= 11 ? agrupar(d, [3, 3, 3, 2], [".", ".", "-"])
    : agrupar(d, [2, 3, 3, 4, 2], [".", ".", "/", "-"]);
}

export function formatarTelefone(v: string): string {
  const d = v.replace(/\D/g, "");
  // International numbers are deliberately left untouched.
  if (v.trimStart().startsWith("+") || d.length > 11) return v;
  if (!d) return "";
  if (d.length <= 2) return `(${d}`;
  return `(${d.slice(0, 2)}) ${agrupar(d.slice(2), d.length === 11 ? [5, 4] : [4, 4], ["-"])}`;
}

/** The quote contact also accepts an email; only mask phone-like input. */
export function formatarContato(v: string): string {
  return /^[\d\s()+.\-]*$/.test(v) ? formatarTelefone(v) : v;
}