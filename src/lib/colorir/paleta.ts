export interface CorSlot {
  nome: string;
  cor: string;
}
export const IMPRESSORAS = [
  { id: "u1", nome: "Snapmaker U1 (4 cores)", slots: 4 },
  { id: "ams", nome: "Bambu com AMS (4)", slots: 4 },
  { id: "ams2", nome: "Bambu com 2 AMS (8)", slots: 8 },
  { id: "outra", nome: "Outra (até 16)", slots: 16 },
] as const;
export const PALETA: CorSlot[] = [
  { nome: "Pele", cor: "#8B5A3C" },
  { nome: "Cabelo", cor: "#2B1D16" },
  { nome: "Turquesa", cor: "#2FB5BE" },
  { nome: "Dourado", cor: "#D4A72C" },
  { nome: "Rosa", cor: "#F0648C" },
  { nome: "Branco", cor: "#FFFFFF" },
  { nome: "Preto", cor: "#000000" },
  { nome: "Vermelho", cor: "#C0392B" },
  ...Array.from({ length: 8 }, (_, i) => ({ nome: `Cor ${i + 9}`, cor: "#FFFFFF" })),
];
export function validarMemoria(raw: unknown): { impressora: string; paleta: CorSlot[] } {
  const obj = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const impressora = IMPRESSORAS.some((p) => p.id === obj["impressora"])
    ? String(obj["impressora"])
    : "u1";
  const list = Array.isArray(obj["paleta"]) ? obj["paleta"] : [];
  return {
    impressora,
    paleta: PALETA.map((base, i) => {
      const c = list[i] as Record<string, unknown> | undefined;
      return c &&
        typeof c["nome"] === "string" &&
        typeof c["cor"] === "string" &&
        /^#[0-9a-f]{6}$/i.test(c["cor"])
        ? { nome: c["nome"].slice(0, 40), cor: c["cor"] }
        : { ...base };
    }),
  };
}
export function lerMemoria() {
  try {
    return validarMemoria(JSON.parse(localStorage.getItem("fatiapro.colorir") ?? "null"));
  } catch {
    return validarMemoria(null);
  }
}
export function guardarMemoria(impressora: string, paleta: CorSlot[]) {
  try {
    localStorage.setItem("fatiapro.colorir", JSON.stringify({ impressora, paleta }));
  } catch {
    /* Storage may be full or disabled; painting remains usable. */
  }
}
export function validarEntrada(file: Pick<File, "name" | "size">): string | null {
  if (!/\.stl$/i.test(file.name)) return "Por enquanto, envie um .stl.";
  if (file.size > 100 * 1024 * 1024) return "O STL deve ter até 100 MB.";
  if (!file.size) return "Este STL está vazio.";
  return null;
}
