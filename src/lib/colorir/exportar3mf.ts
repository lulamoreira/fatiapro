import { Zip, ZipDeflate } from "fflate";
import { encodePaint } from "./pintura";
import type { Pintura } from "./pintura";
export interface MalhaExportavel {
  vertices: Float64Array;
  indices: Uint32Array;
}
const TYPES =
  '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/></Types>';
const RELS =
  '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rel0" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel" Target="/3D/3dmodel.model"/></Relationships>';
/** Chunked encoding and ZIP streaming: never construct a complete XML string. */
export function exportar3mf(
  m: MalhaExportavel,
  p: Pintura,
  progress: (n: number) => void = () => {},
): Blob {
  const chunks: Uint8Array<ArrayBuffer>[] = [];
  let erro: Error | null = null;
  const encoder = new TextEncoder();
  const zip = new Zip((err, data) => {
    if (err) erro = err;
    else chunks.push(new Uint8Array(data));
  });
  function small(name: string, text: string) {
    const file = new ZipDeflate(name, { level: 6 });
    zip.add(file);
    file.push(encoder.encode(text), true);
  }
  small("[Content_Types].xml", TYPES);
  small("_rels/.rels", RELS);
  const file = new ZipDeflate("3D/3dmodel.model", { level: 6 });
  zip.add(file);
  let pending = "";
  function write(s: string) {
    pending += s;
    if (pending.length >= 32768) {
      file.push(encoder.encode(pending), false);
      pending = "";
    }
  }
  const { vertices: v, indices: t } = m;
  let minX = Infinity,
    maxX = -Infinity,
    minY = Infinity,
    maxY = -Infinity,
    minZ = Infinity;
  for (let i = 0; i < v.length; i += 3) {
    minX = Math.min(minX, v[i] ?? 0);
    maxX = Math.max(maxX, v[i] ?? 0);
    minY = Math.min(minY, v[i + 1] ?? 0);
    maxY = Math.max(maxY, v[i + 1] ?? 0);
    minZ = Math.min(minZ, v[i + 2] ?? 0);
  }
  const cx = (minX + maxX) / 2,
    cy = (minY + maxY) / 2;
  write(
    '<?xml version="1.0" encoding="UTF-8"?><model unit="millimeter" xml:lang="pt-BR" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02"><resources><object id="1" type="model"><mesh><vertices>',
  );
  const num = (n: number) => Number(n.toFixed(6)).toString();
  for (let i = 0; i < v.length; i += 3)
    write(
      `<vertex x="${num((v[i] ?? 0) - cx)}" y="${num((v[i + 1] ?? 0) - cy)}" z="${num((v[i + 2] ?? 0) - minZ)}"/>`,
    );
  write("</vertices><triangles>");
  for (let i = 0; i < t.length; i += 3) {
    // Keep the original face index for painting; only omit its geometry.
    if (t[i] === t[i + 1] || t[i] === t[i + 2] || t[i + 1] === t[i + 2]) continue;
    const f = i / 3,
      tree = p.detalhes.get(f),
      slot = p.slots[f] ?? 1,
      paint = tree ? encodePaint(tree) : slot === 1 ? "" : encodePaint({ slot });
    write(
      `<triangle v1="${t[i]}" v2="${t[i + 1]}" v3="${t[i + 2]}"${paint ? ` paint_color="${paint}"` : ""}/>`,
    );
    if (f % 10000 === 0) progress(50 + (f / (t.length / 3)) * 50);
  }
  write(
    '</triangles></mesh></object></resources><build><item objectid="1" transform="1 0 0 0 1 0 0 0 1 0 0 0"/></build></model>',
  );
  file.push(encoder.encode(pending), true);
  zip.end();
  if (erro) throw erro;
  progress(100);
  return new Blob(chunks, { type: "model/3mf" });
}
export const nomeColorido = (name: string) => `${name.replace(/\.stl$/i, "")} - colorido.3mf`;
