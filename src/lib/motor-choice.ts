import type { Motor } from "./fatia";

const MOTOR_IDS: readonly string[] = ["fatiapro", "api", "assinatura"];

/** Resolve only available choices; explicit choice → last used → FatiaProAI → first. */
export function escolherMotor(atual: Motor | null, ultimo: string | null | undefined, disponiveis: readonly Motor[]): Motor | null {
  if (atual && disponiveis.includes(atual)) return atual;
  if (ultimo && MOTOR_IDS.includes(ultimo) && disponiveis.includes(ultimo as Motor)) return ultimo as Motor;
  if (disponiveis.includes("fatiapro")) return "fatiapro";
  return disponiveis[0] ?? null;
}
