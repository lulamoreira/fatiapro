/** Client-safe admin types and pure helpers. */
export type FiltroAdmin = "todos" | "ativos" | "sem_computador" | "bloqueados" | "admins";
export type Situacao = "admin" | "ativo" | "sem_computador" | "bloqueado";

export interface AdminUsuarioLinha {
  id: string;
  nome: string | null;
  email: string;
  criado_em: string;
  ultimo_acesso: string | null;
  computadores: number;
  computadores_on: number;
  analises: number;
  motor_mais_usado: "api" | "assinatura" | null;
  admin: boolean;
  bloqueado: boolean;
  ativo_7d: boolean;
  situacao: Situacao;
}

/** Blocked wins over admin; admin over no-computer. */
export function situacaoUsuario(u: { admin: boolean; bloqueado: boolean; computadores: number }): Situacao {
  if (u.bloqueado) return "bloqueado";
  if (u.admin) return "admin";
  if (u.computadores === 0) return "sem_computador";
  return "ativo";
}

export const SITUACAO: Record<Situacao, { label: string; tone: "primary" | "success" | "warning" | "destructive" }> = {
  admin: { label: "Admin", tone: "primary" },
  ativo: { label: "Ativo", tone: "success" },
  sem_computador: { label: "Sem computador", tone: "warning" },
  bloqueado: { label: "Bloqueado", tone: "destructive" },
};

/** "agora", "há 2 h", "há 6 dias". */
export function relativo(iso: string | null | undefined, now = Date.now()): string {
  if (!iso) return "—";
  const s = Math.max(0, (now - Date.parse(iso)) / 1000);
  if (!Number.isFinite(s)) return "—";
  if (s < 60) return "agora";
  if (s < 3600) return `há ${Math.floor(s / 60)} min`;
  if (s < 86400) return `há ${Math.floor(s / 3600)} h`;
  const d = Math.floor(s / 86400);
  return `há ${d} ${d === 1 ? "dia" : "dias"}`;
}

export function iniciais(nome: string | null, email: string): string {
  const base = (nome || email.split("@")[0] || "?").trim();
  const p = base.split(/\s+/).filter(Boolean);
  return ((p[0]?.[0] ?? "?") + (p.length > 1 ? p[p.length - 1]![0] : "")).toUpperCase();
}

export const ACAO_LABEL: Record<string, string> = {
  bloquear: "Bloqueou",
  desbloquear: "Desbloqueou",
  tornar_admin: "Tornou administrador",
  remover_admin: "Removeu de administrador",
};
