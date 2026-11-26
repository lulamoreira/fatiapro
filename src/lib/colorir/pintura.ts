export type No = { slot: number } | { filhos: [No, No, No, No] };
export type Vec3 = [number, number, number];
export type Triangulo = [Vec3, Vec3, Vec3];
export interface Pintura {
  slots: Uint8Array;
  detalhes: Map<number, No>;
}
export interface Alteracao {
  face: number;
  antes: No;
  depois: No;
}
export const folha = (slot: number): No => ({ slot });
export function subdividir([a, b, c]: Triangulo): [Triangulo, Triangulo, Triangulo, Triangulo] {
  const meio = (u: Vec3, v: Vec3): Vec3 => [
    (u[0] + v[0]) / 2,
    (u[1] + v[1]) / 2,
    (u[2] + v[2]) / 2,
  ];
  const ab = meio(a, b),
    bc = meio(b, c),
    ca = meio(c, a);
  return [
    [a, ab, ca],
    [ab, b, bc],
    [bc, c, ca],
    [ab, bc, ca],
  ];
}
export function lerFace(p: Pintura, f: number): No {
  return p.detalhes.get(f) ?? folha(p.slots[f] ?? 1);
}
export function folhas(n: No, tri: Triangulo, visit: (slot: number, t: Triangulo) => void) {
  if ("slot" in n) visit(n.slot, tri);
  else {
    const ts = subdividir(tri);
    n.filhos.forEach((c, i) => {
      const t = ts[i];
      if (t) folhas(c, t, visit);
    });
  }
}
export function slotMajoritario(n: No): number {
  const pesos = new Float64Array(18);
  function walk(no: No, peso: number) {
    if ("slot" in no) pesos[no.slot] = (pesos[no.slot] ?? 0) + peso;
    else no.filhos.forEach((c) => walk(c, peso / 4));
  }
  walk(n, 1);
  let best = 1;
  for (let i = 2; i < pesos.length; i++) if ((pesos[i] ?? 0) > (pesos[best] ?? 0)) best = i;
  return best;
}
export function escreverFace(p: Pintura, f: number, n: No) {
  if ("slot" in n) {
    p.slots[f] = n.slot;
    p.detalhes.delete(f);
  } else {
    p.detalhes.set(f, n);
    p.slots[f] = slotMajoritario(n);
  }
}
export function trocarSlot(n: No, a: number, b: number): No {
  if ("slot" in n) return folha(n.slot === b ? a : n.slot);
  return compactar({ filhos: n.filhos.map((c) => trocarSlot(c, a, b)) as [No, No, No, No] });
}
export function compactar(n: No): No {
  if ("slot" in n) return n;
  const first = n.filhos[0];
  return "slot" in first && n.filhos.every((c) => "slot" in c && c.slot === first.slot)
    ? folha(first.slot)
    : n;
}
export function coresUsadas(p: Pintura): number[] {
  const used = new Set<number>();
  p.slots.forEach((s) => used.add(s));
  function walk(n: No) {
    if ("slot" in n) used.add(n.slot);
    else n.filhos.forEach(walk);
  }
  p.detalhes.forEach(walk);
  return [...used].sort((a, b) => a - b);
}
interface Passo {
  faces: Uint32Array;
  antes: Uint8Array;
  depois: Uint8Array;
  arvoresAntes: Map<number, No>;
  arvoresDepois: Map<number, No>;
}
export class Historico {
  desfazer: Passo[] = [];
  refazer: Passo[] = [];
  registrar(diff: Alteracao[]) {
    if (!diff.length) return;
    const passo: Passo = {
      faces: new Uint32Array(diff.length),
      antes: new Uint8Array(diff.length),
      depois: new Uint8Array(diff.length),
      arvoresAntes: new Map(),
      arvoresDepois: new Map(),
    };
    diff.forEach((d, i) => {
      passo.faces[i] = d.face;
      if ("slot" in d.antes) passo.antes[i] = d.antes.slot;
      else passo.arvoresAntes.set(d.face, d.antes);
      if ("slot" in d.depois) passo.depois[i] = d.depois.slot;
      else passo.arvoresDepois.set(d.face, d.depois);
    });
    this.desfazer.push(passo);
    if (this.desfazer.length > 50) this.desfazer.shift();
    this.refazer = [];
  }
  voltar(p: Pintura, redo = false): Alteracao[] {
    const origem = redo ? this.refazer : this.desfazer,
      destino = redo ? this.desfazer : this.refazer,
      passo = origem.pop();
    if (!passo) return [];
    const diff: Alteracao[] = [];
    for (let i = 0; i < passo.faces.length; i++) {
      const face = passo.faces[i] ?? 0,
        antes = passo.arvoresAntes.get(face) ?? folha(passo.antes[i] ?? 1),
        depois = passo.arvoresDepois.get(face) ?? folha(passo.depois[i] ?? 1);
      escreverFace(p, face, redo ? depois : antes);
      diff.push({ face, antes, depois });
    }
    destino.push(passo);
    return diff;
  }
}
export function triangulo(p: Float32Array, f: number): Triangulo {
  const v = (i: number): Vec3 => [
    p[f * 9 + i * 3] ?? 0,
    p[f * 9 + i * 3 + 1] ?? 0,
    p[f * 9 + i * 3 + 2] ?? 0,
  ];
  return [v(0), v(1), v(2)];
}
export function encodePaint(n: No): string {
  const digits: number[] = [];
  function emit(no: No) {
    if ("slot" in no) {
      if (!Number.isInteger(no.slot) || no.slot < 1 || no.slot > 17)
        throw new Error("Filamento inválido.");
      if (no.slot <= 2) digits.push(no.slot << 2);
      else digits.push(12, no.slot - 3);
    } else {
      digits.push(3);
      for (let i = 3; i >= 0; i--) {
        const c = no.filhos[i];
        if (c) emit(c);
      }
    }
  }
  emit(n);
  return digits
    .reverse()
    .map((d) => d.toString(16).toUpperCase())
    .join("");
}
export function decodePaint(text: string): No {
  if (!/^[0-9A-F]+$/i.test(text)) throw new Error("Pintura inválida.");
  const ns = Array.from(text)
    .reverse()
    .map((x) => parseInt(x, 16));
  let i = 0;
  function read(depth: number): No {
    if (depth > 16) throw new Error("Pintura muito profunda.");
    const d = ns[i++];
    if (d === 4 || d === 8) return folha(d >> 2);
    if (d === 12) {
      const ext = ns[i++];
      if (ext === undefined || ext > 14) throw new Error("Filamento inválido.");
      return folha(ext + 3);
    }
    if (d === 3) {
      const c3 = read(depth + 1),
        c2 = read(depth + 1),
        c1 = read(depth + 1),
        c0 = read(depth + 1);
      return { filhos: [c0, c1, c2, c3] };
    }
    throw new Error("Pintura incompleta.");
  }
  const n = read(0);
  if (i !== ns.length) throw new Error("Pintura excedente.");
  return n;
}
