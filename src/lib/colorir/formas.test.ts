// @vitest-environment node
import { describe, expect, it } from "vitest";
import { aplicarForma, projetar, planoDaSuperficie, espelharForma } from "./formas";
import type { Forma } from "./formas";
import { folhas, triangulo } from "./pintura";
import type { Triangulo, Vec3 } from "./pintura";

const oval: Forma = {
  tipo: "oval",
  centro: [0, 0, 0],
  camera: [0, 0, 1],
  direita: [1, 0, 0],
  cima: [0, 1, 0],
  largura: 2.7,
  altura: 3.4,
  rotacao: 0,
  curvatura: 1,
  espessura: 0.5,
};
function superficie(point: (x: number, y: number) => Vec3): Float32Array {
  const out: number[] = [];
  const steps = 80;
  for (let i = 0; i < steps; i++)
    for (let j = 0; j < steps; j++) {
      const x = -2.5 + (i * 5) / steps,
        y = -2.5 + (j * 5) / steps,
        d = 5 / steps;
      const a = point(x, y),
        b = point(x + d, y),
        c = point(x + d, y + d),
        e = point(x, y + d);
      out.push(...a, ...b, ...c, ...a, ...c, ...e);
    }
  return new Float32Array(out);
}
function medir(p: Float32Array, f: Forma) {
  let area = 0,
    minX = Infinity,
    maxX = -Infinity,
    minY = Infinity,
    maxY = -Infinity;
  for (let i = 0; i < p.length / 9; i++) {
    const t = triangulo(p, i);
    folhas(aplicarForma(t, { slot: 1 }, f, 2), t, (slot, tri) => {
      if (slot !== 2) return;
      const [a, b, c] = tri.map((v) => projetar(v, f));
      if (!a || !b || !c) throw new Error("Triângulo incompleto");
      area += Math.abs((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])) / 2;
      for (const v of [a, b, c]) {
        minX = Math.min(minX, v[0]);
        maxX = Math.max(maxX, v[0]);
        minY = Math.min(minY, v[1]);
        maxY = Math.max(maxY, v[1]);
      }
    });
  }
  return { area, largura: maxX - minX, altura: maxY - minY };
}
describe("formas na superfície real", () => {
  it("pinta a calota de raio 10 mm com oval 2,7 × 3,4 e erro projetado menor que 3%", () => {
    const p = superficie((x, y) => [x, y, Math.sqrt(100 - x * x - y * y) - 10]);
    const m = medir(p, oval);
    expect(Math.abs(m.area - Math.PI * 1.35 * 1.7) / (Math.PI * 1.35 * 1.7)).toBeLessThan(0.03);
  });
  it("aceita pontos à frente e atrás até 1,5 mm, mas não além da janela simétrica", () => {
    for (const z of [-1.5, -0.5, 0.5, 1.5, -1.51, 1.51]) {
      const t: Triangulo = [
        [-0.1, 0, z],
        [0.1, 0, z],
        [0, 0.1, z],
      ];
      expect(aplicarForma(t, { slot: 1 }, oval, 2)).toEqual({ slot: Math.abs(z) <= 1.5 ? 2 : 1 });
    }
  });
  it("mantém área e medidas reais num plano de 45° com ambas as câmeras", () => {
    const s = Math.SQRT1_2;
    const p = superficie((x, y) => [x, y * s, y * s]);
    const frontal = planoDaSuperficie(p, oval, {
      camera: [0, 0, 1],
      direita: [1, 0, 0],
      cima: [0, 1, 0],
    });
    const perpendicular = planoDaSuperficie(p, oval, {
      camera: [0, -s, s],
      direita: [1, 0, 0],
      cima: [0, s, s],
    });
    const a = medir(p, frontal),
      b = medir(p, perpendicular);
    expect(Math.abs(a.area - b.area) / b.area).toBeLessThan(0.02);
    for (const m of [a, b]) {
      expect(Math.abs(m.area - Math.PI * 1.35 * 1.7) / (Math.PI * 1.35 * 1.7)).toBeLessThan(0.03);
      expect(Math.abs(m.largura - 2.7)).toBeLessThan(0.04);
      expect(Math.abs(m.altura - 3.4)).toBeLessThan(0.04);
    }
    expect(frontal.camera[1]).toBeCloseTo(-s, 5);
    expect(frontal.camera[2]).toBeCloseTo(s, 5);
  });
  it("espelha centro, normal e eixos sem mudar a rotação no plano", () => {
    const f = {
      ...oval,
      centro: [2, 3, 4] as Vec3,
      rotacao: 27,
      camera: [0.6, 0, 0.8] as Vec3,
      direita: [0.8, 0, -0.6] as Vec3,
    };
    const m = espelharForma(f, 1);
    expect(m.centro).toEqual([0, 3, 4]);
    expect(m.camera).toEqual([-0.6, 0, 0.8]);
    expect(m.direita).toEqual([-0.8, 0, -0.6]);
    expect(m.cima).toEqual([0, 1, 0]);
    expect(m.rotacao).toBe(27);
  });
  it("pondera normais pela área e ignora faces de costas", () => {
    const p = new Float32Array([
      0, 0, 0, 2, 0, 0, 0, 2, 0, 0, 0, 0, 1, 0, 0, 0, 1, 1, 0, 0, 0, 0, 4, 0, 4, 0, 0,
    ]);
    const f = planoDaSuperficie(p, oval, oval);
    expect(f.camera[0]).toBe(0);
    expect(f.camera[1]).toBeCloseTo(-1 / Math.sqrt(26));
    expect(f.camera[2]).toBeCloseTo(5 / Math.sqrt(26));
  });
  it("recalcula a normal com o tamanho e o centro da forma", () => {
    const p = new Float32Array([0, 0, 0, 0.3, 0, 0, 0, 0.3, 0, 1, 0, 0, 1.3, 0, 0, 1, 0.3, 0.3]);
    const small = { ...oval, largura: 0.5, altura: 0.5 };
    expect(planoDaSuperficie(p, small, oval).camera).toEqual([0, 0, 1]);
    expect(planoDaSuperficie(p, { ...small, largura: 3 }, oval).camera[1]).toBeLessThan(-0.4);
    expect(planoDaSuperficie(p, { ...small, centro: [1.1, 0.1, 0.1] }, oval).camera[1]).toBeCloseTo(
      -Math.SQRT1_2,
    );
  });
  it("usa o cima da câmera se a normal for quase paralela à direita", () => {
    const p = new Float32Array([0, 0, 0, 0, 1, 0, -0.0000001, 0, 1]);
    const f = planoDaSuperficie(p, oval, oval);
    expect(Math.hypot(...f.camera)).toBeCloseTo(1);
    expect(Math.hypot(...f.direita)).toBeCloseTo(1);
    expect(f.direita.reduce((sum, v, i) => sum + v * (f.camera[i] ?? 0), 0)).toBeCloseTo(0);
    expect(f.cima[1]).toBeCloseTo(1);
  });
});
