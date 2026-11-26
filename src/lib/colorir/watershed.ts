import type { Malha } from "./malha";
export interface Semente {
  id: number;
  face: number;
  slot: number;
  ponto: [number, number, number];
}
/** Binary heap, O((F+E) log F); tie-breaking is deterministic. */
class Heap {
  nodes: number[] = [];
  costs: number[] = [];
  push(n: number, c: number) {
    let i = this.nodes.length;
    this.nodes.push(n);
    this.costs.push(c);
    while (i > 0) {
      const p = (i - 1) >> 1;
      if ((this.costs[p] ?? Infinity) <= c) break;
      this.nodes[i] = this.nodes[p] ?? 0;
      this.costs[i] = this.costs[p] ?? 0;
      i = p;
    }
    this.nodes[i] = n;
    this.costs[i] = c;
  }
  pop(): [number, number] | null {
    if (!this.nodes.length) return null;
    const result: [number, number] = [this.nodes[0] ?? 0, this.costs[0] ?? 0],
      n = this.nodes.pop() ?? 0,
      c = this.costs.pop() ?? 0;
    if (this.nodes.length) {
      let i = 0;
      while (i * 2 + 1 < this.nodes.length) {
        let child = i * 2 + 1;
        if ((this.costs[child + 1] ?? Infinity) < (this.costs[child] ?? Infinity)) child++;
        if ((this.costs[child] ?? Infinity) >= c) break;
        this.nodes[i] = this.nodes[child] ?? 0;
        this.costs[i] = this.costs[child] ?? 0;
        i = child;
      }
      this.nodes[i] = n;
      this.costs[i] = c;
    }
    return result;
  }
}
export function watershed(m: Malha, regioes: Uint32Array, seeds: readonly Semente[]): Uint8Array {
  const n = m.indices.length / 3,
    dist = new Float64Array(n).fill(Infinity),
    out = new Uint8Array(n),
    heap = new Heap(),
    active = new Set(seeds.map((s) => regioes[s.face]));
  for (const s of seeds) {
    if (s.face < 0 || s.face >= n || s.slot < 1 || s.slot > 16) continue;
    dist[s.face] = 0;
    out[s.face] = s.slot;
    heap.push(s.face, 0);
  }
  let entry: [number, number] | null;
  while ((entry = heap.pop())) {
    const [f, cost] = entry;
    if (cost !== (dist[f] ?? Infinity)) continue;
    for (let k = 0; k < 3; k++) {
      const e = f * 3 + k,
        g = m.vizinhos[e] ?? -1;
      if (g < 0 || !active.has(regioes[g]) || regioes[g] !== regioes[f]) continue;
      let d = 0;
      for (let j = 0; j < 3; j++)
        d += ((m.centros[f * 3 + j] ?? 0) - (m.centros[g * 3 + j] ?? 0)) ** 2;
      const next = cost + Math.sqrt(d) * (1 + 300 * (m.concavas[e] ? (m.angulos[e] ?? 0) : 0));
      if (next < (dist[g] ?? Infinity)) {
        dist[g] = next;
        out[g] = out[f] ?? 1;
        heap.push(g, next);
      }
    }
  }
  return out;
}
