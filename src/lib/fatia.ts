/**
 * Domain helpers for FatiaPro: labels, relatório parsing, formatting and
 * cost estimation. Pure functions — safe on client and server, unit-tested.
 */

export type Roteiro = "config_geral" | "reduzir_tempo" | "checklist" | "preco";
export type FatiadorId = "bambu" | "orca" | "snapmaker" | "anycubic";
export type Motor = "assinatura" | "api";
export type Estado =
  | "na_fila"
  | "analisando"
  | "aguardando_aprovacao"
  | "aplicando"
  | "concluido"
  | "erro"
  | "cancelado"
  | "limite_de_gasto";

export const ROTEIROS: { id: Roteiro; label: string }[] = [
  { id: "config_geral", label: "Configuração geral" },
  { id: "reduzir_tempo", label: "Reduzir tempo" },
  { id: "checklist", label: "Checklist antes de imprimir" },
  { id: "preco", label: "Preço de venda" },
];

export const FATIADORES: { id: FatiadorId; label: string }[] = [
  { id: "bambu", label: "Bambu Studio" },
  { id: "orca", label: "OrcaSlicer" },
  { id: "snapmaker", label: "Snapmaker Orca" },
  { id: "anycubic", label: "Anycubic Slicer Next" },
];

export const MOTORES: { id: Motor; label: string }[] = [
  { id: "assinatura", label: "Minha assinatura Claude" },
  { id: "api", label: "Minha chave de API" },
];

export const ESTADOS: Record<Estado, { label: string; tone: "muted" | "primary" | "warning" | "success" | "destructive" }> = {
  na_fila: { label: "Na fila", tone: "muted" },
  analisando: { label: "Analisando", tone: "primary" },
  aguardando_aprovacao: { label: "Aguardando aprovação", tone: "warning" },
  aplicando: { label: "Aplicando", tone: "primary" },
  concluido: { label: "Concluído", tone: "success" },
  erro: { label: "Erro", tone: "destructive" },
  cancelado: { label: "Cancelado", tone: "muted" },
  limite_de_gasto: { label: "Limite de gasto", tone: "destructive" },
};

export const TIPOS_FILAMENTO = ["PLA", "PETG", "TPU", "ABS/ASA"] as const;
export const BICOS = ["0.2", "0.4", "0.6", "0.8"] as const;
export const FINALIDADES = ["Decorativa", "Uso mecânico", "Venda em lote"] as const;
export const PRIORIDADES = ["Tempo", "Acabamento", "Resistência"] as const;

export const roteiroLabel = (r: string | null | undefined) => ROTEIROS.find((x) => x.id === r)?.label ?? "—";
export const fatiadorLabel = (f: string | null | undefined) => FATIADORES.find((x) => x.id === f)?.label ?? "—";
export const motorLabel = (m: string | null | undefined) => (m === "api" ? "API" : m === "assinatura" ? "Assinatura" : "—");

/* ---------- Relatório (written by the bridge) ---------- */

export interface FatiadorRelatorio {
  id: FatiadorId;
  versao: string | null;
  impressoras: string[];
  /** tipo → marca → linhas */
  filamentos: Record<string, Record<string, string[]>>;
}
export interface Relatorio {
  fatiadores: FatiadorRelatorio[];
  motores: { assinatura: boolean; api: boolean };
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const strArr = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);

/** Defensive parser: the relatório comes from an external program. */
export function parseRelatorio(raw: unknown): Relatorio {
  const r = isRecord(raw) ? raw : {};
  const fatiadores: FatiadorRelatorio[] = [];
  if (Array.isArray(r.fatiadores)) {
    for (const f of r.fatiadores) {
      if (!isRecord(f)) continue;
      const id = f.id;
      if (!FATIADORES.some((x) => x.id === id)) continue;
      const fil: Record<string, Record<string, string[]>> = {};
      if (isRecord(f.filamentos)) {
        for (const [tipo, marcas] of Object.entries(f.filamentos)) {
          if (!isRecord(marcas)) continue;
          fil[tipo] = {};
          for (const [marca, linhas] of Object.entries(marcas)) fil[tipo][marca] = strArr(linhas);
        }
      }
      fatiadores.push({
        id: id as FatiadorId,
        versao: typeof f.versao === "string" ? f.versao : null,
        impressoras: strArr(f.impressoras),
        filamentos: fil,
      });
    }
  }
  const m = isRecord(r.motores) ? r.motores : {};
  return { fatiadores, motores: { assinatura: m.assinatura === true, api: m.api === true } };
}

export const MARCA_GENERICA = "Genérica";
export const MARCA_OUTRA = "Outra…";

/** Brands for a type: always Genérica first and Outra… last. */
export function marcasPara(f: FatiadorRelatorio | undefined, tipo: string): string[] {
  const found = Object.keys(f?.filamentos[tipo] ?? {}).filter((m) => m !== MARCA_GENERICA && m !== MARCA_OUTRA);
  return [MARCA_GENERICA, ...found, MARCA_OUTRA];
}

export function linhasPara(f: FatiadorRelatorio | undefined, tipo: string, marca: string): string[] {
  if (marca === MARCA_GENERICA || marca === MARCA_OUTRA) return [tipo];
  const l = f?.filamentos[tipo]?.[marca] ?? [];
  return l.length ? l : [tipo];
}

/* ---------- Connection ---------- */

export function isConectado(ultimoContato: string | null | undefined, now: number): boolean {
  if (!ultimoContato) return false;
  const t = Date.parse(ultimoContato);
  return Number.isFinite(t) && now - t < 60_000;
}

/* ---------- Priority (ranked, max 2) ---------- */

/** Clicking a selected item removes it; a 3rd new click drops the oldest. */
export function togglePrioridade(atual: string[], item: string): string[] {
  if (atual.includes(item)) return atual.filter((x) => x !== item);
  const next = [...atual, item];
  return next.length > 2 ? next.slice(next.length - 2) : next;
}

/* ---------- Formatting ---------- */

export function formatDuracao(segundos: number | null | undefined): string {
  if (segundos == null || !Number.isFinite(segundos)) return "—";
  const neg = segundos < 0;
  const s = Math.round(Math.abs(segundos));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const body = h > 0 ? `${h}h ${String(m).padStart(2, "0")}m` : `${m}m ${String(sec).padStart(2, "0")}s`;
  return neg ? `-${body}` : body;
}

export function formatGramas(g: number | null | undefined): string {
  if (g == null || !Number.isFinite(g)) return "—";
  return `${g.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} g`;
}

export const formatUSD = (v: number) => `US$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`;
export const formatBRL = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/* ---------- Cost estimate ---------- */

export interface Estimativa {
  tokens_entrada_tipicos: number;
  tokens_saida_tipicos: number;
}
export interface Preco {
  preco_entrada_usd_por_milhao: number;
  preco_saida_usd_por_milhao: number;
}

export function custoApiUSD(e: Estimativa, p: Preco): number {
  return (e.tokens_entrada_tipicos * Number(p.preco_entrada_usd_por_milhao) + e.tokens_saida_tipicos * Number(p.preco_saida_usd_por_milhao)) / 1_000_000;
}

export type UsoPlano = "leve" | "médio" | "pesado";
export function usoPlano(tokensEntrada: number): UsoPlano {
  if (tokensEntrada < 25_000) return "leve";
  if (tokensEntrada <= 60_000) return "médio";
  return "pesado";
}
