/** Pure helpers for the "install as app" hint. No service worker is ever used. */
export const CHAVE_DISPENSA = "fatiapro-instalar-dispensado-em";
export const DIAS_DISPENSA = 30;

export type Plataforma = "ios" | "android" | "desktop";

export function plataforma(ua: string, maxTouchPoints = 0): Plataforma {
  if (/iPhone|iPad|iPod/i.test(ua)) return "ios";
  // iPadOS 13+ reports itself as Macintosh but has touch.
  if (/Macintosh/i.test(ua) && maxTouchPoints > 1) return "ios";
  if (/Android/i.test(ua)) return "android";
  return "desktop";
}

/** Safari on iOS (not Chrome/Firefox/Edge wrappers, which cannot add to home screen the same way). */
export function ehSafariIos(ua: string): boolean {
  return !/CriOS|FxiOS|EdgiOS/i.test(ua);
}

export function dispensadoRecente(valor: string | null, agora: number): boolean {
  const t = valor ? Number(valor) : NaN;
  return Number.isFinite(t) && agora - t < DIAS_DISPENSA * 86_400_000;
}

/** Whether the banner may show at all (platform + standalone + dismissal). */
export function mostrarDica(p: Plataforma, standalone: boolean, dispensado: boolean): boolean {
  return p !== "desktop" && !standalone && !dispensado;
}

export function ehStandalone(): boolean {
  if (typeof window === "undefined") return false;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return window.matchMedia?.("(display-mode: standalone)").matches === true || nav.standalone === true;
}

export function lerDispensa(): string | null {
  try { return window.localStorage.getItem(CHAVE_DISPENSA); } catch { return null; }
}

export function gravarDispensa(agora: number): void {
  try { window.localStorage.setItem(CHAVE_DISPENSA, String(agora)); } catch { /* storage blocked: hide only for this session */ }
}
