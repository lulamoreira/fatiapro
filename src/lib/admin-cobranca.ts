/** Client-safe helpers for the admin billing screens (credits, feedback, finance). Pure and unit-tested. */
export const DIA_MS = 86_400_000;
export type Periodo = "hoje" | "7d" | "30d" | "tudo";

/** Start of the São Paulo day (UTC-3, no DST since 2019) as a Date. */
export function inicioDiaSP(agora: Date): Date {
  const ymd = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(agora);
  return new Date(`${ymd}T00:00:00-03:00`);
}

/** null = no lower bound. "7d" = today plus the 6 previous days. */
export function inicioPeriodo(p: Periodo, agora = new Date()): Date | null {
  if (p === "tudo") return null;
  const hoje = inicioDiaSP(agora);
  return p === "hoje" ? hoje : new Date(hoje.getTime() - (p === "7d" ? 6 : 29) * DIA_MS);
}

/** Admin list label: "Teste · dia D/14", "Cortesia", "N créditos" or "Sem créditos". */
export function situacaoCredito(u: { saldo: number; cortesia: boolean; teste: { inicio: string; fim: string } | null }, agora = new Date()): string {
  if (u.cortesia) return "Cortesia";
  if (u.saldo > 0) return `${u.saldo} ${u.saldo === 1 ? "crédito" : "créditos"}`;
  if (u.teste && agora < new Date(u.teste.fim)) {
    const d = Math.floor((inicioDiaSP(agora).getTime() - inicioDiaSP(new Date(u.teste.inicio)).getTime()) / DIA_MS) + 1;
    return `Teste · dia ${Math.min(14, Math.max(1, d))}/14`;
  }
  return "Sem créditos";
}

// ===== Feedback =====
export interface FeedbackRow { fez_sentido: string; imprimiu: string; problemas: string[]; tempo_poupado: string | null }
export interface ResumoFeedback {
  total: number;
  sentido: { sim: number; em_parte: number; nao: number; pct: number | null };
  impressao: { boa: number; problema: number; pct: number | null };
  problemas: Record<string, number>;
  tempo: Record<string, number>;
}

export function resumoFeedback(rows: readonly FeedbackRow[]): ResumoFeedback {
  const cont = (k: keyof FeedbackRow, v: string) => rows.filter((r) => r[k] === v).length;
  const sim = cont("fez_sentido", "sim"), em_parte = cont("fez_sentido", "em_parte"), nao = cont("fez_sentido", "nao");
  const boa = cont("imprimiu", "sim_boa"), problema = cont("imprimiu", "sim_problema");
  const problemas: Record<string, number> = { descolou: 0, suporte: 0, acabamento: 0, fraca: 0, outro: 0 };
  for (const r of rows) for (const p of r.problemas) problemas[p] = (problemas[p] ?? 0) + 1;
  const tempo: Record<string, number> = { nada: 0, ate_15: 0, "15_60": 0, mais_60: 0 };
  for (const r of rows) if (r.tempo_poupado) tempo[r.tempo_poupado] = (tempo[r.tempo_poupado] ?? 0) + 1;
  return {
    total: rows.length,
    sentido: { sim, em_parte, nao, pct: rows.length ? ((sim + em_parte / 2) / rows.length) * 100 : null },
    impressao: { boa, problema, pct: boa + problema ? (boa / (boa + problema)) * 100 : null },
    problemas, tempo,
  };
}

// ===== Financeiro =====
export interface ChamadaRow { job_id: string; user_id: string; modelo: string; custo_usd: number }
export interface JobFinRow { id: string; user_id: string; fonte: string | null; roteiro: string; premium: boolean }
export interface MovRow { tipo: string; quantidade: number }
export interface GrupoFin {
  custo_usd: number; analises: number; medio_usd: number | null;
  por_roteiro: Record<string, { custo_usd: number; analises: number; medio_usd: number | null }>;
  por_modelo: { padrao: number; premium: number };
}

const CLIENTE = new Set(["creditos", "teste", "cortesia", "gratis"]);
export const ehCliente = (fonte: string | null) => !!fonte && CLIENTE.has(fonte);

function grupo(jobs: readonly JobFinRow[], custoJob: Map<string, number>): GrupoFin {
  const g: GrupoFin = { custo_usd: 0, analises: jobs.length, medio_usd: null, por_roteiro: {}, por_modelo: { padrao: 0, premium: 0 } };
  for (const j of jobs) {
    const c = custoJob.get(j.id) ?? 0;
    g.custo_usd += c;
    if (j.premium) g.por_modelo.premium += c; else g.por_modelo.padrao += c;
    const r = (g.por_roteiro[j.roteiro] ??= { custo_usd: 0, analises: 0, medio_usd: null });
    r.custo_usd += c; r.analises++;
  }
  for (const r of Object.values(g.por_roteiro)) r.medio_usd = r.analises ? r.custo_usd / r.analises : null;
  g.medio_usd = g.analises ? g.custo_usd / g.analises : null;
  return g;
}

export function resumoFinanceiro(i: { chamadas: readonly ChamadaRow[]; jobs: readonly JobFinRow[]; movimentos: readonly MovRow[]; cambio: number }) {
  const custoJob = new Map<string, number>();
  for (const c of i.chamadas) custoJob.set(c.job_id, (custoJob.get(c.job_id) ?? 0) + Number(c.custo_usd || 0));
  const cliente = grupo(i.jobs.filter((j) => ehCliente(j.fonte)), custoJob);
  const admin = grupo(i.jobs.filter((j) => j.fonte === "admin"), custoJob);
  // reservas are negative, estornos positive: consumed = -(sum)
  const creditos = -i.movimentos.filter((m) => m.tipo === "reserva" || m.tipo === "estorno").reduce((s, m) => s + m.quantidade, 0);
  const custoCreditosUSD = i.jobs.filter((j) => j.fonte === "creditos").reduce((s, j) => s + (custoJob.get(j.id) ?? 0), 0);
  return {
    cliente, admin,
    total_usd: cliente.custo_usd + admin.custo_usd,
    total_brl: (cliente.custo_usd + admin.custo_usd) * i.cambio,
    creditos_consumidos: creditos,
    custo_por_credito_brl: creditos > 0 ? (custoCreditosUSD * i.cambio) / creditos : null,
  };
}

export const CONFIG_CHAVES = ["alerta_gasto_usd_dia", "limite_diario_gratis", "uso_justo_por_dia", "cambio_brl", "custo_teto_job_usd"] as const;
export type ConfigChave = (typeof CONFIG_CHAVES)[number];
export const CONFIG_LABEL: Record<ConfigChave, string> = {
  alerta_gasto_usd_dia: "Alerta de gasto por dia (US$)",
  limite_diario_gratis: "Análises grátis por dia (Checklist e Preço)",
  uso_justo_por_dia: "Uso justo por dia",
  cambio_brl: "Câmbio R$/US$",
  custo_teto_job_usd: "Teto de custo por análise (US$)",
};
