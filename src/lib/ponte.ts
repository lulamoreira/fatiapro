/** Pure helpers for distributing the FatiaPro Ponte (bridge) installers. */
export type Plataforma = "macos" | "windows";

export const PLATAFORMA_LABEL: Record<Plataforma, string> = { macos: "Mac", windows: "Windows" };
export const VERSAO_RE = /^\d+\.\d+\.\d+$/;

/** Numeric X.Y.Z compare (so 1.10.0 > 1.9.0). Invalid strings sort lowest. */
export function compararVersao(a: string | null | undefined, b: string | null | undefined): number {
  const p = (v: string | null | undefined) => {
    const m = /^(\d+)\.(\d+)\.(\d+)/.exec((v ?? "").trim());
    return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
  };
  const x = p(a), y = p(b);
  if (!x || !y) return x ? 1 : y ? -1 : 0;
  for (let i = 0; i < 3; i++) if (x[i]! !== y[i]!) return x[i]! - y[i]!;
  return 0;
}

export function maisAlta<T extends { versao: string }>(rows: readonly T[]): T | null {
  let best: T | null = null;
  for (const r of rows) if (!best || compararVersao(r.versao, best.versao) > 0) best = r;
  return best;
}

/** Parses the pasted "sha256 <hex>\nassinatura <base64>" block. */
export function parseCodigoAssinatura(txt: string): { sha256: string; assinatura: string } | null {
  const sha = /^\s*sha256\s+([0-9a-fA-F]{64})\s*$/m.exec(txt)?.[1];
  const sig = /^\s*assinatura\s+([A-Za-z0-9+/=_-]+)\s*$/m.exec(txt)?.[1];
  return sha && sig ? { sha256: sha.toLowerCase(), assinatura: sig } : null;
}

export function detectarSistema(nav: { userAgentData?: { platform?: string }; platform?: string; userAgent?: string }): Plataforma | null {
  const s = `${nav.userAgentData?.platform ?? ""} ${nav.platform ?? ""} ${nav.userAgent ?? ""}`.toLowerCase();
  if (/mac|iphone|ipad/.test(s)) return "macos";
  if (/win/.test(s)) return "windows";
  return null;
}

export const extensaoValida = (nome: string, p: Plataforma) => nome.toLowerCase().endsWith(p === "macos" ? ".pkg" : ".exe");
