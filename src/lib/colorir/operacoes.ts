import type { Malha } from "./malha";
import type { No, Vec3 } from "./pintura";
import { folha, triangulo } from "./pintura";
import type { Forma } from "./formas";
import { aplicarForma } from "./formas";
/** Tool predicates are pure; worker owns mutations, history and message ordering. */
export function pintarRegiao(
  f: number,
  antes: No,
  regioes: Uint32Array,
  face: number,
  slot: number,
): No {
  return regioes[f] === regioes[face] ? folha(slot) : antes;
}
export function pintarPincel(
  m: Malha,
  f: number,
  antes: No,
  ponto: Vec3,
  camera: Vec3,
  raio: number,
  slot: number,
): No {
  let d = 0,
    dot = 0;
  for (let k = 0; k < 3; k++) {
    d += ((m.centros[f * 3 + k] ?? 0) - (ponto[k] ?? 0)) ** 2;
    dot += (m.normais[f * 3 + k] ?? 0) * (camera[k] ?? 0);
  }
  return d <= raio ** 2 && dot > 0 ? folha(slot) : antes;
}
export function pintarFormas(m: Malha, f: number, antes: No, formas: Forma[], slot: number): No {
  let next = antes;
  for (const forma of formas) {
    let dot = 0;
    for (let k = 0; k < 3; k++) dot += (m.normais[f * 3 + k] ?? 0) * (forma.camera[k] ?? 0);
    if (dot > 0) next = aplicarForma(triangulo(m.posicoes, f), next, forma, slot);
  }
  return next;
}
