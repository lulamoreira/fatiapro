/**
 * Pure helpers for the Início (KPI) screen and the URL filters it links to.
 * All numbers come already aggregated from SQL (kpis_usuario / kpis_admin).
 */

export const ESTADOS_FILTRO = ["concluido", "aguardando_aprovacao", "em_andamento", "erro", "cancelado"] as const;
export type EstadoFiltro = (typeof ESTADOS_FILTRO)[number];
export const ROTEIROS_FILTRO = ["config_geral", "reduzir_tempo", "checklist", "preco"] as const;
export type RoteiroFiltro = (typeof ROTEIROS_FILTRO)[number];
export const PERIODOS_FILTRO = ["mes", "30d"] as const;
export type PeriodoFiltro = (typeof PERIODOS_FILTRO)[number];
export const STATUS_ORC = ["enviado", "aprovado", "recusado"] as const;
export type StatusOrc = (typeof STATUS_ORC)[number];
export const ABAS_ADMIN = ["usuarios", "historico", "ponte", "feedback", "financeiro", "pacotes", "cupons"] as const;
export type AbaAdmin = (typeof ABAS_ADMIN)[number];
export const FILTROS_ADMIN = ["todos", "ativos", "sem_computador", "bloqueados", "admins"] as const;
export type FiltroAdminUrl = (typeof FILTROS_ADMIN)[number];
export const PERIODOS_ADMIN = ["hoje", "7d", "30d", "mes"] as const;
export type PeriodoAdmin = (typeof PERIODOS_ADMIN)[number];

const um = <T extends string>(lista: readonly T[], v: unknown): T | undefined =>
  typeof v === "string" && (lista as readonly string[]).includes(v) ? (v as T) : undefined;

export interface HistoricoSearch { pagina?: number | undefined; estado?: EstadoFiltro | undefined; roteiro?: RoteiroFiltro | undefined; periodo?: PeriodoFiltro | undefined }
export function lerHistoricoSearch(s: Record<string, unknown>): HistoricoSearch {
  const p = Number(s["pagina"]);
  const out: HistoricoSearch = {};
  if (Number.isInteger(p) && p > 0) out.pagina = p;
  const e = um(ESTADOS_FILTRO, s["estado"]); if (e) out.estado = e;
  const r = um(ROTEIROS_FILTRO, s["roteiro"]); if (r) out.roteiro = r;
  const pe = um(PERIODOS_FILTRO, s["periodo"]); if (pe) out.periodo = pe;
  return out;
}
export const lerOrcSearch = (s: Record<string, unknown>): { status?: StatusOrc } => { const v = um(STATUS_ORC, s["status"]); return v ? { status: v } : {}; };
export function lerAdminSearch(s: Record<string, unknown>): { aba?: AbaAdmin; filtro?: FiltroAdminUrl } {
  const out: { aba?: AbaAdmin; filtro?: FiltroAdminUrl } = {};
  const a = um(ABAS_ADMIN, s["aba"]); if (a) out.aba = a;
  const f = um(FILTROS_ADMIN, s["filtro"]); if (f) out.filtro = f;
  return out;
}

/** Start of the current month in America/Sao_Paulo (UTC-3, no DST). */
export function inicioMesSP(agora = new Date()): Date {
  const sp = new Date(agora.getTime() - 3 * 3_600_000);
  return new Date(Date.UTC(sp.getUTCFullYear(), sp.getUTCMonth(), 1, 3));
}

/** Translates the URL filter into database conditions. */
export function filtroHistorico(f: HistoricoSearch, agora = new Date()): { estados?: string[]; roteiro?: string; desde?: string } {
  const out: { estados?: string[]; roteiro?: string; desde?: string } = {};
  if (f.estado) out.estados = f.estado === "em_andamento" ? ["na_fila", "analisando", "aplicando"] : [f.estado];
  if (f.roteiro) out.roteiro = f.roteiro;
  if (f.periodo === "mes") out.desde = inicioMesSP(agora).toISOString();
  if (f.periodo === "30d") out.desde = new Date(agora.getTime() - 30 * 86_400_000).toISOString();
  return out;
}

export const ROTULO_FILTRO: Record<string, string> = {
  concluido: "Concluídas", aguardando_aprovacao: "Esperando aprovação", em_andamento: "Em andamento", erro: "Com erro", cancelado: "Canceladas",
  config_geral: "Configuração geral", reduzir_tempo: "Reduzir tempo", checklist: "Checklist", preco: "Preço de venda",
  mes: "Este mês", "30d": "Últimos 30 dias", enviado: "Enviados", aprovado: "Aprovados", recusado: "Recusados",
};

/* ---------- Formatting (pt-BR) ---------- */
export const formatInt = (n: number) => Math.round(n).toLocaleString("pt-BR");
export const formatReais = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
export function formatHorasMin(segundos: number): string {
  const m = Math.max(0, Math.round(segundos / 60));
  const h = Math.floor(m / 60), r = m % 60;
  if (h === 0) return `${r}min`;
  return r ? `${h.toLocaleString("pt-BR")}h ${r}min` : `${h.toLocaleString("pt-BR")}h`;
}
export function formatPeso(g: number): string {
  const v = Math.max(0, g);
  if (v >= 1000) return `${(v / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} kg`;
  return `${Math.round(v).toLocaleString("pt-BR")} g`;
}
export const formatPct = (parte: number, total: number): string => (total > 0 ? `${Math.round((parte / total) * 100)}%` : "—");
export const primeiroNome = (nome: string | null | undefined, email?: string | null) =>
  (nome?.trim().split(/\s+/)[0]) || (email ? email.split("@")[0] : "") || "";

/* ---------- Link targets for each card ---------- */
export const linkHistorico = (s: Omit<HistoricoSearch, "pagina"> = {}) => ({ to: "/app/historico" as const, search: s });
export const linkOrc = (status?: StatusOrc) => ({ to: "/app/orcamentos" as const, search: status ? { status } : {} });
export const linkAdmin = (aba: AbaAdmin, filtro?: FiltroAdminUrl) => ({ to: "/app/admin" as const, search: filtro ? { aba, filtro } : { aba } });

export const CHAVE_VISAO = "fatiapro-inicio-visao";
export type Visao = "conta" | "negocio";
export function lerVisao(): Visao { try { return window.localStorage.getItem(CHAVE_VISAO) === "negocio" ? "negocio" : "conta"; } catch { return "conta"; } }
export function gravarVisao(v: Visao) { try { window.localStorage.setItem(CHAVE_VISAO, v); } catch { /* ignore */ } }
