/** Geometry lives in millimetres. Arrays remain compact even for multi-million-face STLs. */
export interface Malha {
  vertices: Float64Array;
  indices: Uint32Array;
  posicoes: Float32Array;
  normais: Float32Array;
  centros: Float64Array;
  vizinhos: Int32Array;
  angulos: Float32Array;
  concavas: Uint8Array;
}
export type Progresso = (etapa: string, percentual: number) => void;
export function lerSTL(buffer: ArrayBuffer): Float32Array {
  if (buffer.byteLength > 100 * 1024 * 1024) throw new Error("O STL deve ter até 100 MB.");
  const view = new DataView(buffer);
  const count = buffer.byteLength >= 84 ? view.getUint32(80, true) : 0;
  if (count > 0 && 84 + count * 50 === buffer.byteLength) {
    const out = new Float32Array(count * 9);
    for (let f = 0; f < count; f++)
      for (let j = 0; j < 9; j++) out[f * 9 + j] = view.getFloat32(84 + f * 50 + 12 + j * 4, true);
    validar(out);
    return out;
  }
  // Two passes avoid an unbounded JS number array for ASCII input.
  const text = new TextDecoder().decode(buffer);
  const re = /\bvertex\s+([-+\d.eE]+)\s+([-+\d.eE]+)\s+([-+\d.eE]+)/g;
  let n = 0;
  while (re.exec(text)) n++;
  if (!n || n % 3) throw new Error("Este STL está vazio ou incompleto.");
  const out = new Float32Array(n * 3);
  re.lastIndex = 0;
  let m: RegExpExecArray | null,
    i = 0;
  while ((m = re.exec(text))) {
    out[i++] = Number(m[1]);
    out[i++] = Number(m[2]);
    out[i++] = Number(m[3]);
  }
  validar(out);
  return out;
}
function validar(p: Float32Array) {
  for (const x of p)
    if (!Number.isFinite(x) || Math.abs(x) > 1e8)
      throw new Error("O STL contém coordenadas inválidas.");
}
export function soldar(posicoes: Float32Array): { vertices: Float64Array; indices: Uint32Array } {
  const n = posicoes.length / 3,
    ordem = new Uint32Array(n),
    bits = new Uint32Array(posicoes.buffer, posicoes.byteOffset, posicoes.length);
  // Compare the original float32 bits, canonicalizing only signed zero.
  const bit = (i: number) => (posicoes[i] === 0 ? 0 : (bits[i] ?? 0));
  for (let i = 0; i < n; i++) ordem[i] = i;
  ordem.sort(
    (a, b) =>
      bit(a * 3) - bit(b * 3) || bit(a * 3 + 1) - bit(b * 3 + 1) || bit(a * 3 + 2) - bit(b * 3 + 2),
  );
  const vertices = new Float64Array(posicoes.length),
    indices = new Uint32Array(n);
  let total = 0,
    anterior = -1;
  for (const i of ordem) {
    const diferente =
      anterior < 0 ||
      bit(i * 3) !== bit(anterior * 3) ||
      bit(i * 3 + 1) !== bit(anterior * 3 + 1) ||
      bit(i * 3 + 2) !== bit(anterior * 3 + 2);
    if (diferente) {
      for (let k = 0; k < 3; k++) vertices[total * 3 + k] = posicoes[i * 3 + k] || 0;
      total++;
    }
    indices[i] = total - 1;
    anterior = i;
  }
  return { vertices: vertices.slice(0, total * 3), indices };
}
export function prepararMalha(p: Float32Array, progresso: Progresso = () => {}): Malha {
  progresso("Soldando", 25);
  const { vertices, indices } = soldar(p);
  const faces = indices.length / 3,
    posicoes = new Float32Array(p.length),
    normais = new Float32Array(faces * 3),
    centros = new Float64Array(faces * 3);
  for (let f = 0; f < faces; f++) {
    for (let v = 0; v < 3; v++)
      for (let k = 0; k < 3; k++)
        posicoes[f * 9 + v * 3 + k] = vertices[(indices[f * 3 + v] ?? 0) * 3 + k] ?? 0;
    const a = f * 9,
      ux = (posicoes[a + 3] ?? 0) - (posicoes[a] ?? 0),
      uy = (posicoes[a + 4] ?? 0) - (posicoes[a + 1] ?? 0),
      uz = (posicoes[a + 5] ?? 0) - (posicoes[a + 2] ?? 0);
    const vx = (posicoes[a + 6] ?? 0) - (posicoes[a] ?? 0),
      vy = (posicoes[a + 7] ?? 0) - (posicoes[a + 1] ?? 0),
      vz = (posicoes[a + 8] ?? 0) - (posicoes[a + 2] ?? 0);
    const nx = uy * vz - uz * vy,
      ny = uz * vx - ux * vz,
      nz = ux * vy - uy * vx,
      len = Math.hypot(nx, ny, nz) || 1;
    normais.set([nx / len, ny / len, nz / len], f * 3);
    for (let k = 0; k < 3; k++)
      centros[f * 3 + k] =
        ((posicoes[a + k] ?? 0) + (posicoes[a + 3 + k] ?? 0) + (posicoes[a + 6 + k] ?? 0)) / 3;
  }
  progresso("Vizinhança", 55);
  // Sorted pair keys are collision-free edge hashes, without string Maps or 53-bit packing.
  const ea = new Uint32Array(faces * 3),
    eb = new Uint32Array(faces * 3),
    ordem = new Uint32Array(faces * 3);
  for (let f = 0; f < faces; f++)
    for (let j = 0; j < 3; j++) {
      const e = f * 3 + j,
        a = indices[e] ?? 0,
        b = indices[f * 3 + ((j + 1) % 3)] ?? 0;
      ea[e] = Math.min(a, b);
      eb[e] = Math.max(a, b);
      ordem[e] = e;
    }
  ordem.sort((a, b) => (ea[a] ?? 0) - (ea[b] ?? 0) || (eb[a] ?? 0) - (eb[b] ?? 0));
  const vizinhos = new Int32Array(faces * 3).fill(-1),
    angulos = new Float32Array(faces * 3),
    concavas = new Uint8Array(faces * 3);
  for (let i = 0; i < ordem.length;) {
    const e = ordem[i] ?? 0;
    let end = i + 1;
    while (end < ordem.length && ea[ordem[end] ?? 0] === ea[e] && eb[ordem[end] ?? 0] === eb[e])
      end++;
    if (end - i === 2 && ea[e] !== eb[e]) {
      const other = ordem[i + 1] ?? 0,
        f = Math.floor(e / 3),
        g = Math.floor(other / 3);
      let dot = 0,
        plano = 0;
      for (let k = 0; k < 3; k++) {
        dot += (normais[f * 3 + k] ?? 0) * (normais[g * 3 + k] ?? 0);
        plano +=
          (normais[f * 3 + k] ?? 0) * ((centros[g * 3 + k] ?? 0) - (centros[f * 3 + k] ?? 0));
      }
      vizinhos[e] = g;
      vizinhos[other] = f;
      angulos[e] = angulos[other] = Math.acos(Math.max(-1, Math.min(1, dot)));
      concavas[e] = concavas[other] = plano > 1e-9 ? 1 : 0;
    }
    i = end;
  }
  return { vertices, indices, posicoes, normais, centros, vizinhos, angulos, concavas };
}
class Uniao {
  pais: Uint32Array;
  tamanhos: Uint32Array;
  constructor(n: number) {
    this.pais = new Uint32Array(n);
    this.tamanhos = new Uint32Array(n).fill(1);
    for (let i = 0; i < n; i++) this.pais[i] = i;
  }
  raiz(a: number): number {
    let r = a;
    while (this.pais[r] !== r) r = this.pais[r] ?? r;
    while (a !== r) {
      const next = this.pais[a] ?? r;
      this.pais[a] = r;
      a = next;
    }
    return r;
  }
  unir(a: number, b: number) {
    a = this.raiz(a);
    b = this.raiz(b);
    if (a === b) return;
    if ((this.tamanhos[a] ?? 0) < (this.tamanhos[b] ?? 0)) [a, b] = [b, a];
    this.pais[b] = a;
    this.tamanhos[a] = (this.tamanhos[a] ?? 0) + (this.tamanhos[b] ?? 0);
  }
}
export function segmentar(m: Malha, sensibilidade = 6, minimo = 150): Uint32Array {
  if (sensibilidade < 2 || sensibilidade > 20)
    throw new Error("Sensibilidade deve ficar entre 2° e 20°.");
  const n = m.indices.length / 3,
    u = new Uniao(n),
    limite = (sensibilidade * Math.PI) / 180;
  for (let e = 0; e < m.vizinhos.length; e++) {
    const g = m.vizinhos[e] ?? -1;
    if (g >= 0 && !(m.concavas[e] && (m.angulos[e] ?? 0) > limite)) u.unir(Math.floor(e / 3), g);
  }
  // Aggregate boundary counts in a typed sorted array. Merge tiny components deterministically.
  const fronteiras = new Uint32Array(m.vizinhos.length);
  let count = 0;
  for (let e = 0; e < m.vizinhos.length; e++) {
    const g = m.vizinhos[e] ?? -1,
      f = Math.floor(e / 3);
    if (g >= 0 && u.raiz(f) !== u.raiz(g)) fronteiras[count++] = e;
  }
  const sorted = fronteiras.subarray(0, count);
  sorted.sort(
    (a, b) =>
      u.raiz(Math.floor(a / 3)) - u.raiz(Math.floor(b / 3)) ||
      u.raiz(m.vizinhos[a] ?? 0) - u.raiz(m.vizinhos[b] ?? 0),
  );
  // Freeze component ids before merging: union changes must not invalidate the sorted runs.
  const roots = new Uint32Array(n);
  for (let f = 0; f < n; f++) roots[f] = u.raiz(f);
  let current = -1,
    best = -1,
    bestCount = 0;
  function finish() {
    if (current >= 0 && (u.tamanhos[u.raiz(current)] ?? 0) < minimo && best >= 0)
      u.unir(current, best);
  }
  for (let i = 0; i < sorted.length;) {
    const e = sorted[i] ?? 0,
      r = roots[Math.floor(e / 3)] ?? 0,
      g = roots[m.vizinhos[e] ?? 0] ?? 0;
    if (r !== current) {
      finish();
      current = r;
      best = -1;
      bestCount = 0;
    }
    let end = i + 1;
    while (
      end < sorted.length &&
      roots[Math.floor((sorted[end] ?? 0) / 3)] === r &&
      roots[m.vizinhos[sorted[end] ?? 0] ?? 0] === g
    )
      end++;
    if (r !== g && end - i > bestCount) {
      best = g;
      bestCount = end - i;
    }
    i = end;
  }
  finish();
  const ids = new Uint32Array(n),
    compact = new Int32Array(n).fill(-1);
  let id = 0;
  for (let f = 0; f < n; f++) {
    const r = u.raiz(f);
    if ((compact[r] ?? -1) < 0) compact[r] = id++;
    ids[f] = compact[r] ?? 0;
  }
  return ids;
}
