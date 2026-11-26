import { BufferGeometry, BufferAttribute } from "three";
import { MeshBVH } from "three-mesh-bvh";
import type { SerializedBVH } from "three-mesh-bvh";
/** Building happens in the worker; the draw geometry stays non-indexed. */
export function construirBVH(posicoes: Float32Array): SerializedBVH | null {
  if (!posicoes.length) return null;
  const g = new BufferGeometry();
  g.setAttribute("position", new BufferAttribute(posicoes, 3));
  const options = { indirect: true, maxLeafTris: 10 };
  const tree = new MeshBVH(g, options);
  const result = MeshBVH.serialize(tree, { cloneBuffers: false });
  g.dispose();
  return result;
}
export function restaurarBVH(g: BufferGeometry, data: SerializedBVH | null) {
  if (!data) return;
  const proxy = new BufferGeometry();
  proxy.setAttribute("position", g.getAttribute("position"));
  g.boundsTree = MeshBVH.deserialize(data, proxy, { setIndex: data.index !== null });
}
