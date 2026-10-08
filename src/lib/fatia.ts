/**
 * Domain helpers for FatiaPro: labels, relatório parsing, formatting and
 * cost estimation. Pure functions — safe on client and server, unit-tested.
 */

export type Roteiro = "config_geral" | "reduzir_tempo" | "checklist" | "preco";
/** Slicer id comes from the bridge report (^[a-z0-9_-]{2,40}$). */
export type FatiadorId = string;
export const FATIADOR_ID_RE = /^[a-z0-9_-]{2,40}$/;
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
  { id: "assinatura", label: "Minha assinatura Claude (admin)" },
  { id: "api", label: "Claude pela sua chave de API" },
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
/** Display name: report name first, then the known names, then the id. */
export const fatiadorLabel = (f: string | null | undefined, rel?: { fatiadores: { id: string; nome: string | null }[] }) =>
  !f ? "—" : rel?.fatiadores.find((x) => x.id === f)?.nome || FATIADORES.find((x) => x.id === f)?.label || f;
/** Name for a report entry. */
export const nomeFatiador = (f: { id: string; nome: string | null }) => f.nome || FATIADORES.find((x) => x.id === f.id)?.label || f.id;
export const motorLabel = (m: string | null | undefined) => (m === "api" ? "API" : m === "assinatura" ? "Assinatura" : "—");

/* ---------- Relatório (written by the bridge) ---------- */

export interface FatiadorRelatorio {
  id: FatiadorId;
  nome: string | null;
  adicionado_manual: boolean;
  versao: string | null;
  impressoras: string[];
  /** tipo → marca → linhas */
  filamentos: Record<string, Record<string, string[]>>;
}
export interface AssinaturaDetalhe {
  instalado: boolean;
  versao: string | null;
  logado: boolean;
}
export interface Relatorio {
  fatiadores: FatiadorRelatorio[];
  motores: { assinatura: boolean; api: boolean; assinatura_detalhe: AssinaturaDetalhe | null };
  pasta_saida_padrao: string | null;
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const strArr = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);

/** Defensive parser: the relatório comes from an external program. */
export function parseRelatorio(raw: unknown): Relatorio {
  const r = (isRecord(raw) ? raw : {}) as { fatiadores?: unknown; motores?: unknown; pasta_saida_padrao?: unknown };
  const fatiadores: FatiadorRelatorio[] = [];
  if (Array.isArray(r.fatiadores)) {
    for (const item of r.fatiadores) {
      if (!isRecord(item)) continue;
      const f = item as { id?: unknown; nome?: unknown; adicionado_manual?: unknown; versao?: unknown; impressoras?: unknown; filamentos?: unknown };
      const id = f.id;
      if (typeof id !== "string" || !FATIADOR_ID_RE.test(id)) continue;
      const fil: Record<string, Record<string, string[]>> = {};
      if (isRecord(f.filamentos)) {
        for (const [tipo, marcas] of Object.entries(f.filamentos)) {
          if (!isRecord(marcas)) continue;
          const porMarca: Record<string, string[]> = {};
          for (const [marca, linhas] of Object.entries(marcas)) porMarca[marca] = strArr(linhas);
          fil[tipo] = porMarca;
        }
      }
      fatiadores.push({ id, nome: typeof f.nome === "string" && f.nome.trim() ? f.nome.trim().slice(0, 80) : null, adicionado_manual: f.adicionado_manual === true, versao: typeof f.versao === "string" ? f.versao : null, impressoras: strArr(f.impressoras), filamentos: fil });
    }
  }
  const m = (isRecord(r.motores) ? r.motores : {}) as { assinatura?: unknown; api?: unknown; assinatura_detalhe?: unknown };
  const ad = isRecord(m.assinatura_detalhe) ? (m.assinatura_detalhe as { instalado?: unknown; versao?: unknown; logado?: unknown }) : null;
  return {
    fatiadores,
    motores: {
      assinatura: m.assinatura === true,
      api: m.api === true,
      assinatura_detalhe: ad ? { instalado: ad.instalado === true, versao: typeof ad.versao === "string" ? ad.versao : null, logado: ad.logado === true } : null,
    },
    pasta_saida_padrao: typeof r.pasta_saida_padrao === "string" && r.pasta_saida_padrao ? r.pasta_saida_padrao : null,
  };
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

/** Standard analyses are always priced with this model. */
export const MODELO_PADRAO = "claude-sonnet-5-5";
/** Measured multiplier for Premium analyses over the standard estimate. */
export const FATOR_PREMIUM = 2.8;

/** Estimated USD cost using the standard model's price (null if not configured). */
export function custoEstimadoUSD<P extends Preco & { modelo: string }>(e: Estimativa, precos: readonly P[], premium = false): number | null {
  const p = precos.find((x) => x.modelo === MODELO_PADRAO);
  if (!p) return null;
  return custoApiUSD(e, p) * (premium ? FATOR_PREMIUM : 1);
}

/** "US$ 0,016" (3 decimals below US$ 0,10, else 2). */
export function formatUSDEstimado(v: number): string {
  const d = v < 0.1 ? 3 : 2;
  return `US$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: d, maximumFractionDigits: d })}`;
}

/** "≈ US$ 0,016 (R$ 0,09)". */
export function textoCustoEstimado(usd: number, cambio: number): string {
  const brl = Number.isFinite(cambio) && cambio > 0 ? ` (${formatBRL(usd * cambio).replace(/\s/g, " ")})` : "";
  return `≈ ${formatUSDEstimado(usd)}${brl}`;
}

export type UsoPlano = "leve" | "médio" | "pesado";
export function usoPlano(tokensEntrada: number): UsoPlano {
  if (tokensEntrada < 25_000) return "leve";
  if (tokensEntrada <= 60_000) return "médio";
  return "pesado";
}

/* ---------- Optimized file name (the bridge uses the same rule) ---------- */

/** Spaces → "-", removes / \ : * ? " < > |; keeps accents and CJK. */
export function limparParte(s: string): string {
  return s.trim().replace(/[\/\\:*?"<>|]/g, "").replace(/\s+/g, "-");
}

export function impressoraSemBico(nome: string): string {
  return nome.replace(/\s*\d+(?:\.\d+)?\s*nozzle\s*$/i, "").trim();
}

export function nomeFilamento(marca: string, linha: string): string {
  const m = marca === MARCA_GENERICA ? "Generico" : marca.trim();
  return materialTexto(m, linha);
}

export interface NomeArquivoInput {
  peca: string | null;
  impressora: string | null;
  bico: string;
  marca: string | null;
  linha: string | null;
  data: Date;
}

/** {peça}_{impressora}_{bico}mm_{filamento}_{AAAA-MM-DD}_{HHhMM}.3mf */
/** True when the preview has every part (piece, printer, filament). */
export const nomeArquivoCompleto = (i: { pecaDefinida: boolean; impressora: string | null; marca: string | null; linha: string | null }) =>
  i.pecaDefinida && !!i.impressora && !!i.marca && !!i.linha;

export function nomeArquivoOtimizado(i: NomeArquivoInput): string {
  const peca = i.peca ? i.peca.replace(/\.[^.]+$/, "") : "peca-aberta";
  const p2 = (n: number) => String(n).padStart(2, "0");
  const d = i.data;
  const partes = [
    limparParte(peca),
    limparParte(impressoraSemBico(i.impressora ?? "")),
    `${limparParte(i.bico)}mm`,
    limparParte(nomeFilamento(i.marca ?? "", i.linha ?? "")),
    `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`,
    `${p2(d.getHours())}h${p2(d.getMinutes())}`,
  ];
  return `${partes.join("_")}.3mf`;
}

/* ---------- Brand list for Nova análise (3 groups) ---------- */

export const MARCAS_COMUNS = [
  "Bambu Lab", "Anycubic", "Creality", "Elegoo", "eSun", "Polymaker", "Sunlu", "Prusament",
  "Overture", "Snapmaker", "Voolt3D", "3D Fila", "3D Lab", "Cliever", "GTMax3D",
] as const;

/** Compare key: no accents, case or spaces ("BambuLab" = "Bambu Lab"). */
export const chaveMarca = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[\s_-]+/g, "").toLowerCase();

const unicos = (lista: string[], excluir: Set<string> = new Set()) => {
  const vistos = new Set(excluir);
  const out: string[] = [];
  for (const m of lista) {
    const t = m.trim();
    const k = chaveMarca(t);
    if (!t || vistos.has(k)) continue;
    vistos.add(k);
    out.push(t);
  }
  return out;
};

export interface GruposMarca { perfil: string[]; outras: string[] }

/**
 * Group b = brands with a profile in the selected slicer; group c = brands of
 * this type in any slicer of the report + common brands (+ the current value,
 * so a loaded model never loses its choice), minus group b. Genérica is separate.
 */
export function gruposMarca(rel: Relatorio, fatiadorId: string | null, tipo: string, atual?: string | null): GruposMarca {
  const gen = chaveMarca(MARCA_GENERICA);
  const fat = rel.fatiadores.find((f) => f.id === fatiadorId);
  const perfil = unicos(Object.keys(fat?.filamentos[tipo] ?? {}), new Set([gen, chaveMarca(MARCA_OUTRA)]));
  const excl = new Set([gen, chaveMarca(MARCA_OUTRA), ...perfil.map(chaveMarca)]);
  const todas = rel.fatiadores.flatMap((f) => Object.keys(f.filamentos[tipo] ?? {}));
  const outras = unicos([...todas, ...MARCAS_COMUNS, ...(atual ? [atual] : [])], excl).sort((a, b) => a.localeCompare(b, "pt-BR"));
  return { perfil, outras };
}

export type GrupoMarca = "generica" | "perfil" | "outras";
export function grupoDaMarca(marca: string, g: GruposMarca): GrupoMarca {
  const k = chaveMarca(marca);
  if (k === chaveMarca(MARCA_GENERICA)) return "generica";
  return g.perfil.some((m) => chaveMarca(m) === k) ? "perfil" : "outras";
}

/** Lines: group b from the selected slicer; group c from any slicer + the type itself. */
export function linhasDaMarca(rel: Relatorio, fatiadorId: string | null, tipo: string, marca: string, grupo: GrupoMarca): string[] {
  if (grupo === "generica") return [tipo];
  const k = chaveMarca(marca);
  const de = (f: FatiadorRelatorio) => Object.entries(f.filamentos[tipo] ?? {}).filter(([m]) => chaveMarca(m) === k).flatMap(([, l]) => l);
  if (grupo === "perfil") {
    const fat = rel.fatiadores.find((f) => f.id === fatiadorId);
    const l = fat ? unicos(de(fat)) : [];
    return l.length ? l : [tipo];
  }
  return unicos([...rel.fatiadores.flatMap(de), tipo]);
}

/** "Bambu Lab PLA Lite" (no repeated brand). */
export const materialTexto = (marca: string, linha: string) => {
  const m = marca.trim();
  const l = linha.trim();
  const palavraMarca = m.split(/\s+/)[0] ?? "";
  const palavraLinha = l.split(/\s+/)[0] ?? "";
  const resto = palavraMarca && chaveMarca(palavraMarca) === chaveMarca(palavraLinha)
    ? l.slice(palavraLinha.length).trimStart() : l;
  return [m, resto].filter(Boolean).join(" ");
};

/** Summary-only printer label; stored profile and output printer name stay intact. */
export function maquinaResumo(impressora: string, fatiador: string, bico: string): string {
  const nome = impressoraSemBico(impressora);
  const marca = fatiador.trim().split(/\s+/)[0] ?? "";
  const primeira = nome.split(/\s+/)[0] ?? "";
  const modelo = marca && chaveMarca(primeira) === chaveMarca(marca)
    ? nome.slice(primeira.length).trimStart() : nome;
  return `${modelo} · bico ${bico} mm`;
}

/** Resolve the only available motor without persisting derived UI state. */
export function motorSelecionado(atual: Motor | null, disponiveis: readonly Motor[]): Motor | null {
  return disponiveis.length === 1 ? disponiveis[0] ?? null : atual;
}

export const TEMP_BICO = { min: 150, max: 320 } as const;
export const TEMP_MESA = { min: 0, max: 130 } as const;
