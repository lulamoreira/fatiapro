/** "What you asked for" summary of a job, built from jobs.opcoes via the existing fromOpcoes parser. */
import { fromOpcoes } from "@/components/fatia/form";
import { materialTexto } from "@/lib/fatia";

export const ROTEIRO_MENU: Record<string, string> = {
  config_geral: "Configurar a peça",
  reduzir_tempo: "Reduzir tempo",
  checklist: "Conferir antes de imprimir",
  preco: "Preço de venda",
};

export interface ResumoPedido { roteiro: string; chips: string[] }

/** Printer profile names already carry the nozzle ("Bambu Lab A1 0.4 nozzle"); drop it so it shows once. */
const semBico = (nome: string) => nome.replace(/\s*\(?\s*[\d.+]+\s*nozzle\s*\)?/i, "").trim();

export function resumoPedido(opcoes: unknown, roteiro: string): ResumoPedido {
  const f = fromOpcoes({ roteiro }, opcoes);
  const chips: string[] = [];
  if (f.finalidades.length) chips.push(f.finalidades.join(", "));
  if (f.prioridades.length) chips.push(`Prioridade: ${f.prioridades.join(", ")}`);
  if (f.impressora) {
    const temBico = !!(opcoes as { bico?: unknown } | null)?.bico;
    chips.push(temBico ? `${semBico(f.impressora)} · ${f.bico} mm` : f.impressora);
  }
  if (f.filMarca && f.filLinha) chips.push(materialTexto(f.filMarca, f.filLinha));
  if (roteiro === "preco") {
    const q = Number(f.preco.quantidade);
    if ((opcoes as { preco?: { quantidade?: unknown } } | null)?.preco?.quantidade != null && q > 0) chips.push(`${q} un.`);
  }
  return { roteiro: ROTEIRO_MENU[roteiro] ?? roteiro, chips };
}
