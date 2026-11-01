/** Nova-análise form state, (de)serialization to job.opcoes and validation. */
import { MARCA_OUTRA, TEMP_BICO, TEMP_MESA, type FatiadorId, type Motor, type Roteiro } from "@/lib/fatia";

/** Torre útil: a sobra das trocas de cor vira uma peça aproveitável (otimização e produção). */
export const TORRES_UTIL = [
  { id: "ovo", label: "Ovo", ajuda: "Usa o seu modelo salvo como ovo.3mf em Documentos/FatiaPro/Pecas uteis. Sem esse arquivo, usa o ovo com escamas do FatiaPro." },
  { id: "porta_lapis", label: "Porta-lápis", ajuda: "Fica com a altura da peça." },
  { id: "vaso", label: "Vaso torcido", ajuda: "Fica com a altura da peça." },
  { id: "caixa", label: "Caixa organizadora", ajuda: "Fica com a altura da peça." },
  { id: "porta_copo", label: "Porta-copo", ajuda: "6 mm de altura. Em peça mais alta, a torre continua ligada." },
  { id: "nenhuma", label: "Não colocar", ajuda: "Fica a torre comum do fatiador." },
] as const;
export type TorreUtil = (typeof TORRES_UTIL)[number]["id"];
export const TORRE_UTIL_NOME: Record<string, string> = Object.fromEntries(TORRES_UTIL.map((t) => [t.id, t.label]));
const TORRES_IDS = new Set<string>(TORRES_UTIL.map((t) => t.id));
/** Accepts only the known tower ids; anything else falls back to "ovo". */
export const torreUtilValida = (v: unknown): TorreUtil => (typeof v === "string" && TORRES_IDS.has(v) ? (v as TorreUtil) : "ovo");

const CHAVE_TORRE = "fatiapro.torre_util";
/** Last chosen tower, remembered locally; never throws (private mode etc.). */
export function lerTorreUtilLocal(): TorreUtil {
  try {
    return torreUtilValida(globalThis.localStorage?.getItem(CHAVE_TORRE));
  } catch {
    return "ovo";
  }
}
export function guardarTorreUtilLocal(v: string): void {
  try {
    globalThis.localStorage?.setItem(CHAVE_TORRE, v);
  } catch {
    /* storage unavailable — ignore */
  }
}

export interface PrecoCampos {
  precoRolo: string;
  pesoRolo: string;
  consumoW: string;
  kwh: string;
  minAcabamento: string;
  rsHora: string;
  quantidade: string;
  taxaFalha: string;
  gramas: number | null;
  segundos: number | null;
}

export interface FormState {
  deviceId: string | null;
  roteiro: Roteiro | null;
  fatiador: FatiadorId | null;
  usarAberta: boolean;
  impressora: string | null;
  bico: string;
  filTipo: string | null;
  filMisto: boolean | null;
  filMistoTipos: string[];
  filMistoCores: { slot: number; tipo: string }[];
  filMarca: string | null;
  /** Optional label temperatures, used when the slicer has no profile for the brand. */
  tempBico: string;
  tempMesa: string;
  filLinha: string | null;
  finalidades: string[];
  prioridades: string[];
  gramasRestantes: string;
  preco: PrecoCampos;
  /** Produção em lote: quantas peças (vazio = encher uma placa). */
  prodQuantidade: string;
  /** Torre útil (otimização e produção). */
  torreUtil: TorreUtil;
  motor: Motor | null;
}

export const FORM_INICIAL: FormState = {
  deviceId: null,
  roteiro: null,
  fatiador: null,
  usarAberta: false,
  impressora: null,
  bico: "0.4",
  filTipo: null,
  filMisto: null,
  filMistoTipos: [],
  filMistoCores: [],
  filMarca: null,
  tempBico: "",
  tempMesa: "",
  filLinha: null,
  finalidades: [],
  prioridades: [],
  gramasRestantes: "",
  preco: { precoRolo: "", pesoRolo: "1", consumoW: "", kwh: "", minAcabamento: "", rsHora: "", quantidade: "1", taxaFalha: "10", gramas: null, segundos: null },
  prodQuantidade: "",
  torreUtil: "ovo",
  motor: null,
};

/** `perfilNoFatiador`: the chosen brand has a profile in the selected slicer. */
export function toOpcoes(f: FormState, perfilNoFatiador = false) {
  const tb = perfilNoFatiador ? null : num(f.tempBico);
  const tm = perfilNoFatiador ? null : num(f.tempMesa);
  return {
    usar_peca_aberta: f.usarAberta,
    impressora: f.impressora,
    bico: f.bico,
    filamento: {
      tipo: f.filTipo,
      marca: f.filMarca,
      linha: f.filLinha,
      perfil_no_fatiador: perfilNoFatiador,
      ...(tb != null ? { temp_bico: tb } : {}),
      ...(tm != null ? { temp_mesa: tm } : {}),
    },
    finalidades: f.finalidades,
    ...(f.filMisto === true ? { filamento_misto: { tem: true, tipos: f.filMistoTipos, cores: f.filMistoCores } } : f.filMisto === false ? { filamento_misto: { tem: false } } : {}),
    prioridades: f.prioridades,
    ...(f.roteiro === "checklist" ? { gramas_restantes: num(f.gramasRestantes) } : {}),
    ...(f.roteiro === "producao" && num(f.prodQuantidade) != null ? { quantidade: num(f.prodQuantidade) } : {}),
    ...(f.roteiro === "config_geral" || f.roteiro === "reduzir_tempo" || f.roteiro === "producao" ? { torre_util: f.torreUtil } : {}),
    ...(f.roteiro === "preco"
      ? {
          preco: {
            preco_rolo_brl: num(f.preco.precoRolo),
            peso_rolo_kg: num(f.preco.pesoRolo),
            consumo_w: num(f.preco.consumoW),
            kwh_brl: num(f.preco.kwh),
            minutos_acabamento: num(f.preco.minAcabamento),
            brl_por_hora: num(f.preco.rsHora),
            quantidade: num(f.preco.quantidade),
            taxa_falha_pct: num(f.preco.taxaFalha),
            gramas: f.preco.gramas,
            segundos: f.preco.segundos,
          },
        }
      : {}),
  };
}

const num = (s: string): number | null => {
  if (!s.trim()) return null;
  const n = Number(s.replace(",", "."));
  return Number.isFinite(n) ? n : null;
};
const str = (v: unknown) => (v == null ? "" : String(v));

interface OpcoesSalvas {
  roteiro?: string | null;
  fatiador?: string | null;
  motor?: string | null;
  usar_peca_aberta?: boolean;
  impressora?: string | null;
  bico?: string;
  filamento?: { tipo?: string | null; marca?: string | null; linha?: string | null; temp_bico?: unknown; temp_mesa?: unknown };
  filamento_marca_escolhida?: string | null;
  filamento_misto?: unknown;
  finalidades?: unknown;
  prioridades?: unknown;
  gramas_restantes?: unknown;
  quantidade?: unknown;
  torre_util?: unknown;
  preco?: Partial<Record<"preco_rolo_brl" | "peso_rolo_kg" | "consumo_w" | "kwh_brl" | "minutos_acabamento" | "brl_por_hora" | "quantidade" | "taxa_falha_pct" | "gramas" | "segundos", unknown>>;
}
const strArr = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);

/** Malformed saved mixed-material data must not become a user selection. */
export function lerFilamentoMisto(raw: unknown): Pick<FormState, "filMisto" | "filMistoTipos" | "filMistoCores"> {
  const inicial = { filMisto: null, filMistoTipos: [], filMistoCores: [] };
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return inicial;
  const o = raw as { tem?: unknown; tipos?: unknown; cores?: unknown };
  if (typeof o.tem !== "boolean") return inicial;
  if (o.tipos !== undefined && (!Array.isArray(o.tipos) || !o.tipos.every((v) => typeof v === "string"))) return inicial;
  const corValida = (v: unknown): v is { slot: number; tipo: string } => {
    if (!v || typeof v !== "object") return false;
    const c = v as { slot?: unknown; tipo?: unknown };
    return typeof c.slot === "number" && Number.isInteger(c.slot) && c.slot > 0 && typeof c.tipo === "string";
  };
  if (o.cores !== undefined && (!Array.isArray(o.cores) || !o.cores.every(corValida))) return inicial;
  return { filMisto: o.tem, filMistoTipos: o.tem ? strArr(o.tipos) : [], filMistoCores: o.tem && Array.isArray(o.cores) ? o.cores.filter(corValida) : [] };
}

/** Rebuild a form from a saved preset or an earlier job. */
export function fromOpcoes(
  base: { roteiro?: string | null; fatiador?: string | null; motor?: string | null; device_id?: string | null },
  raw: unknown,
): FormState {
  const o = (raw ?? {}) as OpcoesSalvas;
  const p = o.preco ?? {};
  return {
    ...FORM_INICIAL,
    ...lerFilamentoMisto(o.filamento_misto),
    deviceId: base.device_id ?? null,
    roteiro: (base.roteiro ?? o.roteiro ?? null) as Roteiro | null,
    fatiador: (base.fatiador ?? o.fatiador ?? null) as FatiadorId | null,
    motor: (base.motor ?? o.motor ?? null) as Motor | null,
    usarAberta: o.usar_peca_aberta === true,
    impressora: o.impressora ?? null,
    bico: o.bico ?? "0.4",
    filTipo: o.filamento?.tipo ?? null,
    // Old jobs stored "Outra…" in filamento_marca_escolhida and the typed brand in filamento.marca.
    filMarca: (o.filamento?.marca && o.filamento.marca !== MARCA_OUTRA ? o.filamento.marca : o.filamento_marca_escolhida !== MARCA_OUTRA ? o.filamento_marca_escolhida : null) ?? null,
    tempBico: str(o.filamento?.temp_bico),
    tempMesa: str(o.filamento?.temp_mesa),
    filLinha: o.filamento?.linha ?? null,
    finalidades: strArr(o.finalidades),
    prioridades: strArr(o.prioridades).slice(0, 2),
    gramasRestantes: str(o.gramas_restantes),
    prodQuantidade: str(o.quantidade),
    torreUtil: torreUtilValida(o.torre_util),
    preco: {
      precoRolo: str(p.preco_rolo_brl),
      pesoRolo: str(p.peso_rolo_kg ?? 1),
      consumoW: str(p.consumo_w),
      kwh: str(p.kwh_brl),
      minAcabamento: str(p.minutos_acabamento),
      rsHora: str(p.brl_por_hora),
      quantidade: str(p.quantidade ?? 1),
      taxaFalha: str(p.taxa_falha_pct ?? 10),
      gramas: typeof p.gramas === "number" ? p.gramas : null,
      segundos: typeof p.segundos === "number" ? p.segundos : null,
    },
  };
}

export type ErroKey = "device" | "roteiro" | "fatiador" | "peca" | "impressora" | "filamento" | "motor" | "gramasRestantes" | "prodQuantidade" | "tempBico" | "tempMesa" | keyof PrecoCampos;
export type Erros = Partial<Record<ErroKey, string>>;

export function validar(f: FormState, temArquivo: boolean): Erros {
  const e: Erros = {};
  const preco = f.roteiro === "preco";
  if (!f.deviceId) e.device = "Escolha um computador.";
  if (!f.roteiro) e.roteiro = "Escolha um roteiro.";
  if (!preco && !f.fatiador) e.fatiador = "Escolha o fatiador.";
  if (!preco && !temArquivo && !f.usarAberta) e.peca = "Envie um arquivo ou use a peça aberta no fatiador.";
  if (f.fatiador && !f.impressora) e.impressora = "Escolha a impressora.";
  if (!f.filTipo) e.filamento = "Escolha o tipo de filamento.";
  else if (!f.filMarca) e.filamento = "Escolha a marca.";
  else if (!f.filLinha) e.filamento = "Escolha a linha.";
  const fora = (v: string, r: { min: number; max: number }) => { const n = num(v); return v.trim() !== "" && (n == null || n < r.min || n > r.max); };
  if (fora(f.tempBico, TEMP_BICO)) e.tempBico = `Entre ${TEMP_BICO.min} e ${TEMP_BICO.max} °C`;
  if (fora(f.tempMesa, TEMP_MESA)) e.tempMesa = `Entre ${TEMP_MESA.min} e ${TEMP_MESA.max} °C`;
  if (!f.motor) e.motor = "Escolha o motor.";
  if (f.roteiro === "checklist" && !(Number(f.gramasRestantes) > 0)) e.gramasRestantes = "Informe as gramas restantes no rolo.";
  if (f.roteiro === "producao" && f.prodQuantidade.trim() !== "") {
    const q = num(f.prodQuantidade);
    if (q == null || !Number.isInteger(q) || q < 1 || q > 5000) e.prodQuantidade = "Quantidade inteira entre 1 e 5000.";
  }
  if (preco) {
    if (!(Number(f.preco.precoRolo.replace(",", ".")) > 0)) e.precoRolo = "Informe o preço do rolo.";
    if (!(Number(f.preco.pesoRolo.replace(",", ".")) > 0)) e.pesoRolo = "Informe o peso do rolo.";
    if (!(Number(f.preco.kwh.replace(",", ".")) >= 0) || !f.preco.kwh.trim()) e.kwh = "Informe o preço do kWh.";
    if (!(Number(f.preco.rsHora.replace(",", ".")) >= 0) || !f.preco.rsHora.trim()) e.rsHora = "Informe o valor da hora.";
    if (!(Number(f.preco.quantidade) >= 1)) e.quantidade = "Quantidade mínima 1.";
  }
  return e;
}

export const EXTENSOES = ["stl", "3mf", "step", "stp"];
export const MAX_BYTES = 100 * 1024 * 1024;
