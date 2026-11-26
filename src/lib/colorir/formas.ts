import { compactar, folha, subdividir } from "./pintura";
import type { No, Triangulo, Vec3 } from "./pintura";
export interface Forma {
  tipo: "oval" | "sorriso";
  centro: Vec3;
  direita: Vec3;
  cima: Vec3;
  camera: Vec3;
  largura: number;
  altura: number;
  rotacao: number;
  curvatura: number;
  espessura: number;
}
const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
function unit(v: Vec3): Vec3 {
  const length = Math.hypot(...v);
  if (length < 1e-12) throw new Error("Não foi possível orientar a forma nesta superfície.");
  return [v[0] / length, v[1] / length, v[2] / length];
}
export type EixosCamera = Pick<Forma, "camera" | "direita" | "cima">;
/** The cross product is twice face area times its normal: no per-face normalization needed. */
export function planoDaSuperficie(p: Float32Array, f: Forma, view: EixosCamera): Forma {
  const radius2 = (Math.max(f.largura, f.altura) / 2) ** 2;
  let nx = 0,
    ny = 0,
    nz = 0,
    closest = Infinity;
  let fallback: Vec3 = view.camera;
  for (let i = 0; i < p.length; i += 9) {
    const ax = p[i] ?? 0,
      ay = p[i + 1] ?? 0,
      az = p[i + 2] ?? 0;
    const bx = p[i + 3] ?? 0,
      by = p[i + 4] ?? 0,
      bz = p[i + 5] ?? 0;
    const cx = p[i + 6] ?? 0,
      cy = p[i + 7] ?? 0,
      cz = p[i + 8] ?? 0;
    const ux = bx - ax,
      uy = by - ay,
      uz = bz - az;
    const vx = cx - ax,
      vy = cy - ay,
      vz = cz - az;
    const x = uy * vz - uz * vy,
      y = uz * vx - ux * vz,
      z = ux * vy - uy * vx;
    if (x * view.camera[0] + y * view.camera[1] + z * view.camera[2] <= 0) continue;
    const distance2 =
      ((ax + bx + cx) / 3 - f.centro[0]) ** 2 +
      ((ay + by + cy) / 3 - f.centro[1]) ** 2 +
      ((az + bz + cz) / 3 - f.centro[2]) ** 2;
    if (distance2 < closest) {
      closest = distance2;
      fallback = [x, y, z];
    }
    if (distance2 <= radius2) {
      nx += x;
      ny += y;
      nz += z;
    }
  }
  // Coarse triangles may have no centroid within the radius: use the nearest visible face.
  const normal = unit(Math.hypot(nx, ny, nz) > 1e-12 ? [nx, ny, nz] : fallback);
  const component = dot(view.direita, normal);
  let right: Vec3 = [
    view.direita[0] - component * normal[0],
    view.direita[1] - component * normal[1],
    view.direita[2] - component * normal[2],
  ];
  if (Math.hypot(...right) < 1e-6) right = cross(view.cima, normal);
  right = unit(right);
  return { ...f, camera: normal, direita: right, cima: unit(cross(normal, right)) };
}
export function espelharForma(f: Forma, cx: number): Forma {
  const reflect = (v: Vec3): Vec3 => [v[0] === 0 ? 0 : -v[0], v[1], v[2]];
  return {
    ...f,
    centro: [2 * cx - f.centro[0], f.centro[1], f.centro[2]],
    camera: reflect(f.camera),
    direita: reflect(f.direita),
    cima: reflect(f.cima),
  };
}
export function projetar(p: Vec3, f: Forma): [number, number, number] {
  const d: Vec3 = [p[0] - f.centro[0], p[1] - f.centro[1], p[2] - f.centro[2]],
    x = dot(d, f.direita),
    y = dot(d, f.cima),
    a = (f.rotacao * Math.PI) / 180;
  return [x * Math.cos(a) + y * Math.sin(a), -x * Math.sin(a) + y * Math.cos(a), dot(d, f.camera)];
}
export function dentro(x: number, y: number, f: Forma): boolean {
  const u = x / (f.largura / 2);
  if (Math.abs(u) > 1) return false;
  if (f.tipo === "oval") return u * u + (y / (f.altura / 2)) ** 2 <= 1;
  const curva = f.curvatura * (u * u - 1),
    esp = f.espessura * (1 - u * u);
  return Math.abs(y - curva) <= esp / 2;
}
export function aplicarForma(tri: Triangulo, anterior: No, f: Forma, slot: number, depth = 0): No {
  if (!(f.largura > 0 && f.altura > 0 && f.espessura > 0))
    throw new Error("As medidas da forma devem ser positivas.");
  const pts = tri.map((p) => projetar(p, f));
  const maxY = f.tipo === "oval" ? f.altura / 2 : Math.abs(f.curvatura) + f.espessura;
  // Bounding-box pruning finds small shapes completely enclosed in a triangle, even if all seven samples miss.
  if (
    Math.min(...pts.map((p) => p[0])) > f.largura / 2 ||
    Math.max(...pts.map((p) => p[0])) < -f.largura / 2 ||
    Math.min(...pts.map((p) => p[1])) > maxY ||
    Math.max(...pts.map((p) => p[1])) < -maxY ||
    Math.max(...pts.map((p) => p[2])) < -1.5 ||
    Math.min(...pts.map((p) => p[2])) > 1.5
  )
    return anterior;
  const children = subdividir(tri),
    centro: Vec3 = [
      (tri[0][0] + tri[1][0] + tri[2][0]) / 3,
      (tri[0][1] + tri[1][1] + tri[2][1]) / 3,
      (tri[0][2] + tri[1][2] + tri[2][2]) / 3,
    ];
  const samples = [...tri, children[0][1], children[1][2], children[0][2], centro];
  const inside = samples.map((p) => {
    const [x, y, z] = projetar(p, f);
    return z >= -1.5 && z <= 1.5 && dentro(x, y, f);
  });
  if (inside.every(Boolean)) return folha(slot);
  const maxEdge = Math.max(
    ...tri.map((p, i) => {
      const q = tri[(i + 1) % 3] ?? p;
      return Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
    }),
  );
  if (depth >= 7 || maxEdge < 0.015) {
    // Existing detail trees keep their structure; sampling at depth 7 must never nest them deeper.
    if ("slot" in anterior) return inside[6] ? folha(slot) : anterior;
    return compactar({
      filhos: children.map((t, i) =>
        aplicarForma(t, anterior.filhos[i] ?? folha(1), f, slot, depth + 1),
      ) as [No, No, No, No],
    });
  }
  return compactar({
    filhos: children.map((t, i) =>
      aplicarForma(
        t,
        "slot" in anterior ? anterior : (anterior.filhos[i] ?? folha(1)),
        f,
        slot,
        depth + 1,
      ),
    ) as [No, No, No, No],
  });
}
