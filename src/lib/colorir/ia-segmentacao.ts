import type { Malha } from "./malha";
/** Width thresholds in mm, taken from the measured spider-web lines (≈1,4–1,75 mm) and squares (> 2,8 mm). */
export const LARGURA_LINHA = 2, LARGURA_GROSSA = 2.5;
type MalhaMin = Pick<Malha, "vizinhos" | "posicoes">;
export interface MedidasRegioes { area: Map<number, number>; borda: Map<number, number>; total: number }
function areaFace(p: Float32Array, f: number): number {
  const i = f * 9, ux = (p[i + 3] ?? 0) - (p[i] ?? 0), uy = (p[i + 4] ?? 0) - (p[i + 1] ?? 0), uz = (p[i + 5] ?? 0) - (p[i + 2] ?? 0),
    vx = (p[i + 6] ?? 0) - (p[i] ?? 0), vy = (p[i + 7] ?? 0) - (p[i + 1] ?? 0), vz = (p[i + 8] ?? 0) - (p[i + 2] ?? 0);
  return Math.hypot(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx) / 2;
}
/** Edge e = vertex e%3 → (e+1)%3 of face e/3, the same convention prepararMalha uses for vizinhos. */
export function comprimentoAresta(p: Float32Array, e: number): number {
  const f = Math.floor(e / 3), a = f * 9 + (e % 3) * 3, b = f * 9 + ((e + 1) % 3) * 3;
  return Math.hypot((p[a] ?? 0) - (p[b] ?? 0), (p[a + 1] ?? 0) - (p[b + 1] ?? 0), (p[a + 2] ?? 0) - (p[b + 2] ?? 0));
}
export function medirRegioes(m: MalhaMin, regioes: ArrayLike<number>): MedidasRegioes {
  const area = new Map<number, number>(), borda = new Map<number, number>();
  let total = 0;
  for (let f = 0; f < regioes.length; f++) {
    const id = regioes[f] ?? 0, a = areaFace(m.posicoes, f);
    total += a;
    area.set(id, (area.get(id) ?? 0) + a);
    for (let k = 0; k < 3; k++) {
      const g = m.vizinhos[f * 3 + k] ?? -1;
      if (g >= 0 && regioes[g] !== id) borda.set(id, (borda.get(id) ?? 0) + comprimentoAresta(m.posicoes, f * 3 + k));
    }
  }
  return { area, borda, total };
}
/** 2 × area ÷ border length with other regions; a region with no border is "infinitely" wide. */
export function larguraMedia(area: number, borda: number): number {
  return borda > 0 ? (2 * area) / borda : Infinity;
}
/** Large narrow regions, including elongated contours up to 3.3 mm wide. */
export function ehRegiaoLinha(area: number, borda: number, total: number): boolean {
  const largura = larguraMedia(area, borda);
  return area > total * 0.01 && (largura < LARGURA_LINHA || (largura < 3.3 && area / (borda * borda) < 0.02));
}
/** Uses the same pure rule for inheritance exclusions and mandatory image regions. */
export function regioesLinha(m: MalhaMin, regioes: ArrayLike<number>, medidas = medirRegioes(m, regioes)): Set<number> {
  const out = new Set<number>();
  for (const [id, a] of medidas.area)
    if (ehRegiaoLinha(a, medidas.borda.get(id) ?? 0, medidas.total)) out.add(id);
  return out;
}
/**
 * Replaces only "mixed" base regions (thin line ≥ 40% + thick parts ≥ 5%) by their finer sub-regions.
 * Unchanged regions keep their ids; returns the same array when nothing is mixed.
 */
export function refinarMistas(m: MalhaMin, base: Uint32Array, fina: Uint32Array): Uint32Array {
  const pares = new Map<string, number>(), partes = new Uint32Array(base.length), donos: number[] = [];
  for (let f = 0; f < base.length; f++) {
    const k = `${base[f] ?? 0}:${fina[f] ?? 0}`;
    let id = pares.get(k);
    if (id === undefined) { id = donos.length; pares.set(k, id); donos.push(base[f] ?? 0); }
    partes[f] = id;
  }
  const med = medirRegioes(m, partes), porBase = new Map<number, { total: number; fina: number; grossa: number; ids: number[] }>();
  for (const [id, a] of med.area) {
    const b = donos[id] ?? 0, s = porBase.get(b) ?? { total: 0, fina: 0, grossa: 0, ids: [] };
    const w = larguraMedia(a, med.borda.get(id) ?? 0);
    s.total += a; s.ids.push(id);
    if (w < LARGURA_LINHA) s.fina += a; else if (w > LARGURA_GROSSA) s.grossa += a;
    porBase.set(b, s);
  }
  const mistas = new Set<number>();
  for (const [b, s] of porBase) if (s.ids.length > 1 && s.fina >= s.total * 0.4 && s.grossa >= s.total * 0.05) mistas.add(b);
  if (!mistas.size) return base;
  let proximo = 0;
  for (const id of base) proximo = Math.max(proximo, id + 1);
  const novo = new Map<number, number>(), out = base.slice();
  for (let f = 0; f < base.length; f++) {
    if (!mistas.has(base[f] ?? 0)) continue;
    const p = partes[f] ?? 0;
    let id = novo.get(p);
    if (id === undefined) { id = proximo++; novo.set(p, id); }
    out[f] = id;
  }
  return out;
}
/** Faces within two rings of a region boundary, for the "conferir" outline. */
export function facesDeBorda(m: Pick<Malha, "vizinhos">, regioes: ArrayLike<number>): Uint8Array {
  const n = regioes.length, out = new Uint8Array(n);
  for (let f = 0; f < n; f++) for (let k = 0; k < 3; k++) { const g = m.vizinhos[f * 3 + k] ?? -1; if (g >= 0 && regioes[g] !== regioes[f]) out[f] = 1; }
  const anel = out.slice();
  for (let f = 0; f < n; f++) if (anel[f]) for (let k = 0; k < 3; k++) { const g = m.vizinhos[f * 3 + k] ?? -1; if (g >= 0 && regioes[g] === regioes[f]) out[g] = 1; }
  return out;
}
