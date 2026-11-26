// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { Blob as NodeBlob } from "node:buffer";
beforeAll(() => vi.stubGlobal("Blob", NodeBlob));
afterAll(() => vi.unstubAllGlobals());
import { unzipSync, strFromU8 } from "fflate";
import { lerSTL, prepararMalha, segmentar, soldar } from "./malha";
import { encodePaint, decodePaint, folhas, triangulo, Historico, escreverFace } from "./pintura";
import type { No, Triangulo, Pintura } from "./pintura";
import { aplicarForma } from "./formas";
import type { Forma } from "./formas";
import { watershed } from "./watershed";
import { exportar3mf } from "./exportar3mf";
import { validarEntrada, validarMemoria } from "./paleta";
import { construirBVH, restaurarBVH } from "./bvh";
import { BufferAttribute, BufferGeometry, Ray, Vector3, DoubleSide } from "three";
import { pintarPincel, pintarRegiao } from "./operacoes";
const vertices = [
  [0, 0, 0],
  [1, 0, 0],
  [1, 1, 0],
  [0, 1, 0],
  [0, 0, 1],
  [1, 0, 1],
  [1, 1, 1],
  [0, 1, 1],
];
const faces = [
  [0, 2, 1],
  [0, 3, 2],
  [4, 5, 6],
  [4, 6, 7],
  [0, 1, 5],
  [0, 5, 4],
  [1, 2, 6],
  [1, 6, 5],
  [2, 3, 7],
  [2, 7, 6],
  [3, 0, 4],
  [3, 4, 7],
];
const cube = new Float32Array(faces.flatMap((f) => f.flatMap((i) => vertices[i] ?? [])));
function ascii(p: Float32Array) {
  let text = "solid cube\n";
  for (let f = 0; f < p.length / 9; f++) {
    text += "facet normal 0 0 0\nouter loop\n";
    for (let v = 0; v < 3; v++)
      text += `vertex ${p[f * 9 + v * 3]} ${p[f * 9 + v * 3 + 1]} ${p[f * 9 + v * 3 + 2]}\n`;
    text += "endloop\nendfacet\n";
  }
  return new TextEncoder().encode(text + "endsolid cube").buffer;
}
function binary(p: Float32Array) {
  const b = new ArrayBuffer(84 + (p.length / 9) * 50),
    v = new DataView(b);
  v.setUint32(80, p.length / 9, true);
  for (let f = 0; f < p.length / 9; f++)
    for (let j = 0; j < 9; j++) v.setFloat32(84 + f * 50 + 12 + j * 4, p[f * 9 + j] ?? 0, true);
  return b;
}
/** Two tessellated wings meeting at the internal 90° crease, each above the 150-face merge threshold. */
function lMesh() {
  const out: number[] = [];
  const steps = 12;
  for (let wing = 0; wing < 2; wing++)
    for (let i = 0; i < steps; i++)
      for (let j = 0; j < steps; j++) {
        const point = (u: number, v: number) => (wing === 0 ? [u, v, 0] : [0, v, u]);
        const a = point(i / steps, j / steps),
          b = point((i + 1) / steps, j / steps),
          c = point((i + 1) / steps, (j + 1) / steps),
          d = point(i / steps, (j + 1) / steps);
        const tris = wing === 0 ? [a, b, c, a, c, d] : [a, c, b, a, d, c];
        out.push(...tris.flat());
      }
  return prepararMalha(new Float32Array(out));
}
describe("STL e regiões", () => {
  it("restaura BVH sem indexar ou reordenar a malha visual", () => {
    const serialized = construirBVH(cube),
      geo = new BufferGeometry();
    geo.setAttribute("position", new BufferAttribute(cube, 3));
    restaurarBVH(geo, serialized);
    expect(geo.index).toBeNull();
    expect(
      geo.boundsTree?.raycastFirst(
        new Ray(new Vector3(0.2, -2, 0.3), new Vector3(0, 1, 0)),
        DoubleSide,
      )?.faceIndex,
    ).toBe(5);
    geo.dispose();
  });
  it("lê cubo binário e ASCII", () => {
    expect(lerSTL(binary(cube))).toEqual(cube);
    expect(lerSTL(ascii(cube))).toEqual(cube);
  });
  it("solda 12 triângulos em 8 vértices", () => expect(soldar(cube).vertices.length / 3).toBe(8));
  it("não une vértices separados por 0,00005 mm", () => {
    const p = new Float32Array([0, 0, 0, 0.00005, 0, 0]);
    const m = soldar(p);
    expect(m.vertices.length / 3).toBe(2);
    expect(m.indices[0]).not.toBe(m.indices[1]);
    expect([...m.vertices]).toContain(p[3]);
  });
  it("solda por bits float32, respeitando offsets e tratando -0 como 0", () => {
    const buffer = new Float32Array([99, 0, -0, 0, -0, 0, -0, 99]);
    const m = soldar(buffer.subarray(1, 7));
    expect(m.vertices.length / 3).toBe(1);
    expect([...m.indices]).toEqual([0, 0]);
    expect([...m.vertices].some((v) => Object.is(v, -0))).toBe(false);
  });
  it("cubo convexo dá uma região", () =>
    expect(new Set(segmentar(prepararMalha(cube), 6)).size).toBe(1));
  it("vinco interno em L separa duas regiões a 6 graus", () =>
    expect(new Set(segmentar(lMesh(), 6)).size).toBe(2));
  it("watershed respeita vinco interno com uma semente em cada bloco", () => {
    const m = lMesh(),
      r = new Uint32Array(m.indices.length / 3),
      n = r.length / 2,
      out = watershed(m, r, [
        { id: 1, face: 0, slot: 1, ponto: [0, 0, 0] },
        { id: 2, face: n, slot: 2, ponto: [0, 0, 0] },
      ]);
    expect(out[0]).toBe(1);
    expect(out[n]).toBe(2);
    expect([...out.slice(0, n)].filter((s) => s === 1).length / n).toBeGreaterThan(0.95);
    expect([...out.slice(n)].filter((s) => s === 2).length / n).toBeGreaterThan(0.95);
  });
  it("ignora aresta não-manifold", () => {
    const t = new Float32Array([
      0, 0, 0, 1, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0, 0, -1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1,
    ]);
    expect([...prepararMalha(t).vizinhos].every((v) => v === -1)).toBe(true);
  });
});
describe("paint_color", () => {
  it("ida e volta de slots 1 a 17", () => {
    for (let slot = 1; slot <= 17; slot++)
      expect(decodePaint(encodePaint({ slot }))).toEqual({ slot });
  });
  it("exemplos fixos", () => {
    expect(encodePaint({ slot: 2 })).toBe("8");
    expect(encodePaint({ slot: 3 })).toBe("0C");
    const no: No = { filhos: [{ slot: 1 }, { slot: 2 }, { slot: 1 }, { slot: 1 }] };
    expect(encodePaint(no)).toBe("48443");
    expect(decodePaint("48443")).toEqual(no);
  });
  it("árvore de profundidade 3 preserva ordem e slots altos", () => {
    const tree = (d: number): No =>
      d === 0 ? { slot: 17 } : { filhos: [tree(d - 1), { slot: 3 }, { slot: 2 }, { slot: 4 }] };
    expect(decodePaint(encodePaint(tree(3)))).toEqual(tree(3));
  });
});
const forma: Forma = {
  tipo: "oval",
  centro: [0, 0, 0],
  direita: [1, 0, 0],
  cima: [0, 1, 0],
  camera: [0, 0, 1],
  largura: 2,
  altura: 2,
  rotacao: 0,
  curvatura: 1,
  espessura: 0.5,
};
const area = (t: Triangulo) =>
  Math.abs((t[1][0] - t[0][0]) * (t[2][1] - t[0][1]) - (t[1][1] - t[0][1]) * (t[2][0] - t[0][0])) /
  2;
describe("formas e pintura", () => {
  it("formas sobrepostas não aumentam a profundidade além de 7", () => {
    const tri: Triangulo = [
      [-5, -4, 0],
      [5, -4, 0],
      [0, 6, 0],
    ];
    let n: No = { slot: 1 };
    for (let i = 0; i < 4; i++)
      n = aplicarForma(tri, n, { ...forma, centro: [i * 0.1, 0, 0] }, (i % 2) + 2);
    const depth = (no: No): number => ("slot" in no ? 0 : 1 + Math.max(...no.filhos.map(depth)));
    expect(depth(n)).toBeLessThanOrEqual(7);
    expect(depth(n)).toBeGreaterThan(0);
  });
  it("alterar segmentação mantém slots e árvores por face", () => {
    const m = lMesh(),
      p: Pintura = { slots: new Uint8Array(m.indices.length / 3).fill(1), detalhes: new Map() },
      tree: No = { filhos: [{ slot: 1 }, { slot: 2 }, { slot: 3 }, { slot: 4 }] };
    escreverFace(p, 0, tree);
    escreverFace(p, 1, { slot: 3 });
    segmentar(m, 20);
    expect(p.detalhes.get(0)).toBe(tree);
    expect(p.slots[1]).toBe(3);
  });
  it("pincel pinta apenas centróides no raio e voltados para a câmera", () => {
    const m = prepararMalha(cube);
    expect(pintarPincel(m, 4, { slot: 1 }, [0.67, 0, 0.33], [0, -1, 0], 0.5, 2)).toEqual({
      slot: 2,
    });
    expect(pintarPincel(m, 4, { slot: 1 }, [0.67, 0, 0.33], [0, 1, 0], 10, 2)).toEqual({ slot: 1 });
    expect(pintarPincel(m, 4, { slot: 1 }, [10, 10, 10], [0, -1, 0], 0.5, 2)).toEqual({ slot: 1 });
  });
  it("balde usa id de região e apaga detalhe ao pintar a face inteira", () => {
    const n: No = { filhos: [{ slot: 2 }, { slot: 1 }, { slot: 1 }, { slot: 1 }] },
      r = new Uint32Array([0, 0, 1]);
    expect(pintarRegiao(0, n, r, 1, 3)).toEqual({ slot: 3 });
    expect(pintarRegiao(2, n, r, 1, 3)).toBe(n);
  });
  it("oval de 2 mm dentro de triângulo gera árvore e área com erro menor que 5%", () => {
    const tri: Triangulo = [
        [-5, -4, 0],
        [5, -4, 0],
        [0, 6, 0],
      ],
      n = aplicarForma(tri, { slot: 1 }, forma, 2);
    expect("filhos" in n).toBe(true);
    let total = 0;
    folhas(n, tri, (s, t) => {
      if (s === 2) total += area(t);
    });
    expect(Math.abs(total - Math.PI) / Math.PI).toBeLessThan(0.05);
  });
  it("triângulo totalmente dentro vira slot inteiro", () =>
    expect(
      aplicarForma(
        [
          [-0.1, 0, 0],
          [0.1, 0, 0],
          [0, 0.1, 0],
        ],
        { slot: 1 },
        forma,
        3,
      ),
    ).toEqual({ slot: 3 }));
  it("não pinta superfície mais de 1,5 mm atrás", () =>
    expect(
      aplicarForma(
        [
          [-0.1, 0, -2],
          [0.1, 0, -2],
          [0, 0.1, -2],
        ],
        { slot: 1 },
        forma,
        3,
      ),
    ).toEqual({ slot: 1 }));
  it("face inteira apaga árvore e desfazer restaura a árvore", () => {
    const p: Pintura = { slots: new Uint8Array([1]), detalhes: new Map() },
      n: No = { filhos: [{ slot: 1 }, { slot: 2 }, { slot: 1 }, { slot: 1 }] };
    escreverFace(p, 0, n);
    const h = new Historico();
    h.registrar([{ face: 0, antes: n, depois: { slot: 3 } }]);
    escreverFace(p, 0, { slot: 3 });
    expect(p.detalhes.size).toBe(0);
    h.voltar(p);
    expect(p.detalhes.get(0)).toEqual(n);
    h.voltar(p, true);
    expect(p.slots[0]).toBe(3);
  });
  it("histórico limita a 50 passos", () => {
    const h = new Historico();
    for (let i = 0; i < 51; i++)
      h.registrar([{ face: 0, antes: { slot: 1 }, depois: { slot: 2 } }]);
    expect(h.desfazer).toHaveLength(50);
  });
});
describe("3MF e entrada", () => {
  it("omite faces degeneradas sem deslocar a pintura das demais", async () => {
    const m = soldar(
      new Float32Array([
        0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1, 1, 0, 1, 0, 1, 1,
      ]),
    );
    const tree: No = { filhos: [{ slot: 1 }, { slot: 2 }, { slot: 3 }, { slot: 4 }] };
    const p: Pintura = { slots: new Uint8Array([2, 3, 1]), detalhes: new Map([[2, tree]]) };
    const zip = unzipSync(new Uint8Array(await exportar3mf(m, p).arrayBuffer()));
    const xml = strFromU8(zip["3D/3dmodel.model"] ?? new Uint8Array());
    const triangles = [...xml.matchAll(/<triangle v1="(\d+)" v2="(\d+)" v3="(\d+)"([^>]*)\/>/g)];
    expect(triangles).toHaveLength(2);
    for (const t of triangles) expect(new Set(t.slice(1, 4)).size).toBe(3);
    expect(triangles[0]?.[4]).toContain(`paint_color="${encodePaint({ slot: 2 })}"`);
    expect(triangles[1]?.[4]).toContain(`paint_color="${encodePaint(tree)}"`);
  });
  it("zip contém exatamente três arquivos, malha soldada e nenhuma configuração", async () => {
    const m = prepararMalha(cube),
      p: Pintura = { slots: new Uint8Array(12).fill(2), detalhes: new Map() },
      blob = exportar3mf(m, p),
      entries = unzipSync(new Uint8Array(await blob.arrayBuffer()));
    expect(Object.keys(entries).sort()).toEqual(
      ["3D/3dmodel.model", "[Content_Types].xml", "_rels/.rels"].sort(),
    );
    const xml = strFromU8(entries["3D/3dmodel.model"] ?? new Uint8Array());
    expect(xml.match(/<triangle /g) ?? []).length(12);
    expect(xml.match(/<vertex /g) ?? []).length(8);
    expect(xml).not.toContain("Application");
    expect(xml).toContain('transform="1 0 0 0 1 0 0 0 1 0 0 0"');
    expect(xml).toContain('x="-0.5"');
    expect(xml).toContain('paint_color="8"');
  });
  it("aceita no máximo 100 MB e apenas STL", () => {
    expect(validarEntrada({ name: "a.stl", size: 100 * 1024 * 1024 })).toBeNull();
    expect(validarEntrada({ name: "a.stl", size: 100 * 1024 * 1024 + 1 })).not.toBeNull();
    expect(validarEntrada({ name: "a.3mf", size: 1 })).toBe("Por enquanto, envie um .stl.");
  });
  it("memória inválida preserva padrão e paleta de 16 slots", () => {
    expect(validarMemoria(null).impressora).toBe("u1");
    expect(
      validarMemoria({ impressora: "ams2", paleta: [{ nome: "Olhos", cor: "#123456" }] }).paleta[0],
    ).toEqual({ nome: "Olhos", cor: "#123456" });
    expect(validarMemoria(null).paleta).toHaveLength(16);
  });
});
