// @vitest-environment node
import { describe, it, expect } from "vitest";
import { prepararMalha } from "./malha";
import { herdarCores, escolherRegioes } from "./ia-regioes";
import { refinarMistas, regioesLinha, larguraMedia, medirRegioes, facesDeBorda } from "./ia-segmentacao";
import { montarPrevia } from "./ia-previa";
/** Flat 28,8 mm plate: 3×3 squares of 8 mm separated by a 1,2 mm grid of lines (cells of 0,4 mm). */
function grade() {
  const cel = 0.4, n = 72, p: number[] = [], reg: number[] = [];
  const zona = (i: number) => { const k = i % 23; return k < 3 ? -1 : Math.floor(i / 23); };
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    const x = i * cel, y = j * cel, zi = zona(i), zj = zona(j), id = zi < 0 || zj < 0 || zi > 2 || zj > 2 ? 9 : zj * 3 + zi;
    p.push(x, y, 0, x + cel, y, 0, x + cel, y + cel, 0, x, y, 0, x + cel, y + cel, 0, x, y + cel, 0);
    reg.push(id, id);
  }
  return { m: prepararMalha(new Float32Array(p)), regioes: new Uint32Array(reg) };
}
describe("linhas finas no Colorir pela foto", () => {
  it("mede a grade como linha (< 2 mm) e os quadrados como grossos", () => {
    const { m, regioes } = grade(), med = medirRegioes(m, regioes);
    expect(larguraMedia(med.area.get(9) ?? 0, med.borda.get(9) ?? 0)).toBeLessThan(2);
    expect(larguraMedia(med.area.get(0) ?? 0, med.borda.get(0) ?? 0)).toBeGreaterThan(2.8);
    expect([...regioesLinha(m, regioes)]).toEqual([9]);
  });
  it("quadrados não enviados herdam vermelho do outro lado da linha, não o preto da grade", () => {
    const { m, regioes } = grade(), cores = herdarCores(m, regioes, new Map([[0, 2], [9, 3]]), regioesLinha(m, regioes));
    for (let q = 0; q < 9; q++) expect(cores.get(q)).toBe(2);
    expect(cores.get(9)).toBe(3);
  });
  it("sem linhas, a herança antiga continua igual (vizinha com mais arestas)", () => {
    const { m, regioes } = grade(), cores = new Map([[0, 2], [9, 3]]);
    expect([...herdarCores(m, regioes, cores)]).toEqual([...herdarCores(m, regioes, cores, new Set())]);
    expect(herdarCores(m, regioes, cores).get(4)).toBe(3);
  });
  it("a prévia pinta os 8 quadrados omitidos de vermelho", () => {
    const { m, regioes } = grade(), linhas = regioesLinha(m, regioes);
    const p = montarPrevia(m, regioes, { slots: new Uint8Array(regioes.length).fill(1), detalhes: new Map() }, { regioes: [{ id: 0, slot: 2 }, { id: 9, slot: 3 }], sementes: [], formas: [] }, true, linhas);
    for (let f = 0; f < regioes.length; f++) expect(p.slots[f]).toBe(regioes[f] === 9 ? 3 : 2);
  });
  it("linha grande entra sempre entre as 60 enviadas", () => {
    const areas = [...Array.from({ length: 80 }, (_, id) => ({ id, area: 10 })), { id: 99, area: 1 }];
    const ids = escolherRegioes(areas, new Set([99])).map((r) => r.id);
    expect(ids).toHaveLength(60);
    expect(ids).toContain(99);
  });
  it("região mista (grade + quadrados juntos) vira as sub-regiões finas; a maior fica fina e pura", () => {
    const { m, regioes } = grade(), base = regioes.map((r) => (r === 9 || r < 3 ? 9 : r)), out = refinarMistas(m, base, regioes);
    const med = medirRegioes(m, out), maior = [...med.area].sort((a, b) => b[1] - a[1])[0];
    if (!maior) throw new Error();
    expect(larguraMedia(maior[1], med.borda.get(maior[0]) ?? 0)).toBeLessThan(1.8);
    const faces = [...out.keys()].filter((f) => out[f] === maior[0]);
    expect(new Set(faces.map((f) => regioes[f]))).toEqual(new Set([9]));
  });
  it("sem região mista, as regiões continuam exatamente as mesmas", () => {
    const { m, regioes } = grade();
    expect(refinarMistas(m, regioes, regioes)).toBe(regioes);
    const fatiada = regioes.map((r, f) => (r === 4 ? 4 + (f % 2) * 100 : r));
    expect(refinarMistas(m, regioes, fatiada)).toBe(regioes);
  });
  it("realce conferir marca só a borda, nunca o miolo", () => {
    const { m, regioes } = grade(), b = facesDeBorda(m, regioes), miolo = [...regioes.keys()].filter((f) => regioes[f] === 4 && !b[f]);
    expect(miolo.length).toBeGreaterThan(0);
    expect([...regioes.keys()].some((f) => regioes[f] === 4 && b[f])).toBe(true);
  });
});
