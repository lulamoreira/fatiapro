import { useEffect, useMemo, useRef } from "react";
import { BufferGeometry, BufferAttribute, Color, MeshStandardMaterial } from "three";
import type { Mesh, WebGLProgramParametersWithUniforms } from "three";
import { useThree } from "@react-three/fiber";
import type { ThreeEvent } from "@react-three/fiber";
import { acceleratedRaycast } from "three-mesh-bvh";
import { restaurarBVH } from "@/lib/colorir/bvh";
import type { DadosCena } from "./useColorir";
import type { CorSlot } from "@/lib/colorir/paleta";
export interface GeometriaProps {
  dados: DadosCena;
  paleta: CorSlot[];
  verRegioes: boolean;
  hover: number;
  onHit: (event: ThreeEvent<PointerEvent>, face: number, slot: number, drag: boolean) => void;
  onHover: (face: number) => void;
  onFim: () => void;
}
function rgb(slot: number, paleta: CorSlot[], regiao: number, ver: boolean): Color {
  return ver
    ? new Color().setHSL(((regiao * 137.508) % 360) / 360, 0.55, 0.55)
    : new Color(paleta[slot - 1]?.cor ?? "#FFFFFF");
}
function writeColor(a: Uint8Array, f: number, c: Color) {
  for (let v = 0; v < 3; v++) {
    const i = f * 9 + v * 3;
    a[i] = Math.round(c.r * 255);
    a[i + 1] = Math.round(c.g * 255);
    a[i + 2] = Math.round(c.b * 255);
  }
}
export function Geometria(p: GeometriaProps) {
  const invalidate = useThree((s) => s.invalidate),
    drag = useRef(false),
    shader = useRef<WebGLProgramParametersWithUniforms | null>(null);
  const geo = useMemo(() => {
    const g = new BufferGeometry();
    g.setAttribute("position", new BufferAttribute(p.dados.posicoes, 3));
    const normals = new Float32Array(p.dados.posicoes.length);
    for (let f = 0; f < p.dados.slots.length; f++)
      for (let v = 0; v < 3; v++)
        normals.set(p.dados.normais.subarray(f * 3, f * 3 + 3), f * 9 + v * 3);
    g.setAttribute("normal", new BufferAttribute(normals, 3));
    g.setAttribute("color", new BufferAttribute(new Uint8Array(normals.length), 3, true));
    g.setAttribute("region", new BufferAttribute(new Float32Array(normals.length / 3), 1));
    g.computeBoundingBox();
    g.computeBoundingSphere();
    restaurarBVH(g, p.dados.bvh);
    return g;
  }, [p.dados.posicoes, p.dados.normais]);
  const mat = useMemo(() => {
    const m = new MeshStandardMaterial({ vertexColors: true, roughness: 0.85 });
    m.onBeforeCompile = (s) => {
      s.uniforms["hoverRegion"] = { value: -1 };
      s.vertexShader =
        "attribute float region; varying float vRegion;\n" +
        s.vertexShader.replace(
          "#include <begin_vertex>",
          "#include <begin_vertex>\nvRegion = region;",
        );
      s.fragmentShader =
        "uniform float hoverRegion; varying float vRegion;\n" +
        s.fragmentShader.replace(
          "#include <color_fragment>",
          "#include <color_fragment>\nif(abs(vRegion-hoverRegion)<0.1) diffuseColor.rgb=mix(diffuseColor.rgb,vec3(1.0),0.28);",
        );
      shader.current = s;
    };
    return m;
  }, []);
  useEffect(() => {
    const attr = geo.getAttribute("region");
    for (let f = 0; f < p.dados.regioes.length; f++)
      for (let v = 0; v < 3; v++) attr.setX(f * 3 + v, p.dados.regioes[f] ?? 0);
    attr.needsUpdate = true;
    invalidate();
  }, [geo, p.dados.regioes, invalidate]);
  // Full upload only when changing the palette/segmentation view. Paint uses bounded update ranges.
  useEffect(() => {
    const attr = geo.getAttribute("color") as BufferAttribute;
    const a = attr.array as Uint8Array;
    for (let f = 0; f < p.dados.slots.length; f++)
      writeColor(a, f, rgb(p.dados.slots[f] ?? 1, p.paleta, p.dados.regioes[f] ?? 0, p.verRegioes));
    attr.clearUpdateRanges();
    attr.needsUpdate = true;
    invalidate();
  }, [geo, p.paleta, p.verRegioes, p.dados.regioes, invalidate]);
  useEffect(() => {
    const attr = geo.getAttribute("color") as BufferAttribute,
      a = attr.array as Uint8Array;
    for (const f of p.dados.alteradas) {
      writeColor(a, f, rgb(p.dados.slots[f] ?? 1, p.paleta, p.dados.regioes[f] ?? 0, p.verRegioes));
      attr.addUpdateRange(f * 9, 9);
    }
    if (p.dados.alteradas.length) attr.needsUpdate = true;
    p.dados.alteradas = new Uint32Array();
    invalidate();
  }, [geo, p.dados.revisao, invalidate]);
  useEffect(() => {
    if (shader.current?.uniforms["hoverRegion"])
      shader.current.uniforms["hoverRegion"].value = p.hover;
    invalidate();
  }, [p.hover, invalidate]);
  useEffect(
    () => () => {
      geo.dispose();
    },
    [geo],
  );
  useEffect(() => () => mat.dispose(), [mat]);
  const handle = (e: ThreeEvent<PointerEvent>, f: number, s: number, isDrag: boolean) => {
    e.stopPropagation();
    p.onHit(e, f, s, isDrag);
  };
  const handlers = {
    onPointerDown: (e: ThreeEvent<PointerEvent>) => {
      if (e.button !== 0) return;
      drag.current = true;
      const f = e.faceIndex ?? -1;
      if (f >= 0) handle(e, f, p.dados.slots[f] ?? 1, false);
    },
    onPointerMove: (e: ThreeEvent<PointerEvent>) => {
      const f = e.faceIndex ?? -1;
      if (f >= 0) {
        e.stopPropagation();
        p.onHover(f);
        if (drag.current && e.buttons === 1) handle(e, f, p.dados.slots[f] ?? 1, true);
      }
    },
    onPointerUp: () => {
      drag.current = false;
      p.onFim();
    },
    onPointerOut: () => p.onHover(-1),
  };
  return (
    <>
      <mesh geometry={geo} material={mat} raycast={acceleratedRaycast} {...handlers} />
      <Detalhes
        dados={p.dados}
        paleta={p.paleta}
        ver={p.verRegioes}
        onHit={handle}
        onHover={p.onHover}
        onFim={p.onFim}
      />
    </>
  );
}
function Detalhes({
  dados,
  paleta,
  ver,
  onHit,
  onHover,
  onFim,
}: {
  dados: DadosCena;
  paleta: CorSlot[];
  ver: boolean;
  onHit: GeometriaProps["onHit"];
  onHover: (f: number) => void;
  onFim: () => void;
}) {
  const invalidate = useThree((s) => s.invalidate),
    drag = useRef(false);
  const g = useMemo(() => {
    const geo = new BufferGeometry();
    geo.setAttribute("position", new BufferAttribute(dados.detalhes.posicoes, 3));
    geo.setAttribute(
      "color",
      new BufferAttribute(new Uint8Array(dados.detalhes.posicoes.length), 3, true),
    );
    geo.computeVertexNormals();
    restaurarBVH(geo, dados.detalhes.bvh);
    return geo;
  }, [dados.detalhes]);
  useEffect(() => {
    const attr = g.getAttribute("color") as BufferAttribute;
    for (let f = 0; f < dados.detalhes.slots.length; f++)
      writeColor(
        attr.array as Uint8Array,
        f,
        rgb(
          dados.detalhes.slots[f] ?? 1,
          paleta,
          dados.regioes[dados.detalhes.faces[f] ?? 0] ?? 0,
          ver,
        ),
      );
    attr.needsUpdate = true;
    invalidate();
  }, [g, paleta, ver, dados.regioes, invalidate]);
  useEffect(() => () => g.dispose(), [g]);
  function hit(e: ThreeEvent<PointerEvent>, move = false) {
    const i = e.faceIndex ?? -1;
    if (i < 0) return;
    e.stopPropagation();
    const f = dados.detalhes.faces[i] ?? 0;
    onHover(f);
    if (!move || (drag.current && e.buttons === 1)) onHit(e, f, dados.detalhes.slots[i] ?? 1, move);
  }
  return (
    <mesh
      geometry={g}
      raycast={acceleratedRaycast}
      onPointerDown={(e) => {
        if (e.button === 0) {
          drag.current = true;
          hit(e);
        }
      }}
      onPointerMove={(e) => hit(e, true)}
      onPointerUp={() => {
        drag.current = false;
        onFim();
      }}
    >
      <meshStandardMaterial
        vertexColors
        roughness={0.85}
        polygonOffset
        polygonOffsetFactor={-2}
        polygonOffsetUnits={-2}
      />
    </mesh>
  );
}
