import type { Motor } from "./fatia";

/** Resolve only available choices; explicit choices take precedence over history. */
export function escolherMotor(atual: Motor | null, ultimo: string | null | undefined, disponiveis: readonly Motor[]): Motor | null {
  if (atual && disponiveis.includes(atual)) return atual;
  if ((ultimo === "api" || ultimo === "assinatura") && disponiveis.includes(ultimo)) return ultimo;
  if (disponiveis.includes("api")) return "api";
  return disponiveis[0] ?? null;
}