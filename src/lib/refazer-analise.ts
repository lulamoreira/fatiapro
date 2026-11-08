import type { Estado } from "@/lib/fatia";

/**
 * "Refazer com outras escolhas" só aparece quando a análise terminou
 * (concluída, com erro ou cancelada) — nunca durante a execução nem
 * enquanto espera aprovação.
 */
const ESTADOS_REFAZER: readonly Estado[] = ["concluido", "erro", "cancelado"];

export function podeRefazer(estado: Estado): boolean {
  return ESTADOS_REFAZER.includes(estado);
}

/** A peça veio de "Usar a peça aberta no fatiador" (opcoes.usar_peca_aberta). */
export function veioDePecaAberta(opcoes: unknown): boolean {
  if (!opcoes || typeof opcoes !== "object" || Array.isArray(opcoes)) return false;
  return (opcoes as { usar_peca_aberta?: unknown }).usar_peca_aberta === true;
}
