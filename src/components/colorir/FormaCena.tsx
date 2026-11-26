import { useRef } from "react";
import { Line } from "@react-three/drei";
import { Plane, Vector3 } from "three";
import { useThree } from "@react-three/fiber";
import { espelharForma } from "@/lib/colorir/formas";
import type { ThreeEvent } from "@react-three/fiber";
import type { Forma } from "@/lib/colorir/formas";
import type { Vec3 } from "@/lib/colorir/pintura";
export interface FormaCenaProps {
  forma: Forma;
  onForma: (f: Forma) => void;
  cor: string;
  espelho: boolean;
  centroX: number;
}
export function pontoForma(f: Forma, x: number, y: number): Vec3 {
  const a = (f.rotacao * Math.PI) / 180,
    u = x * Math.cos(a) - y * Math.sin(a),
    v = x * Math.sin(a) + y * Math.cos(a);
  return [
    f.centro[0] + f.direita[0] * u + f.cima[0] * v + f.camera[0] * 0.025,
    f.centro[1] + f.direita[1] * u + f.cima[1] * v + f.camera[1] * 0.025,
    f.centro[2] + f.direita[2] * u + f.cima[2] * v + f.camera[2] * 0.025,
  ];
}
export function FormaCena({ forma: f, onForma, cor, espelho, centroX }: FormaCenaProps) {
  const drag = useRef<"centro" | "tamanho" | null>(null);
  const { scene, raycaster } = useThree();
  const points: Vec3[] = [];
  if (f.tipo === "oval") {
    for (let i = 0; i <= 80; i++) {
      const a = (i / 80) * Math.PI * 2;
      points.push(pontoForma(f, (Math.cos(a) * f.largura) / 2, (Math.sin(a) * f.altura) / 2));
    }
  } else {
    for (const side of [1, -1])
      for (let i = 0; i <= 40; i++) {
        const u = side === 1 ? -1 + i / 20 : 1 - i / 20;
        points.push(
          pontoForma(
            f,
            (u * f.largura) / 2,
            f.curvatura * (u * u - 1) + (side * f.espessura * (1 - u * u)) / 2,
          ),
        );
      }
    const first = points[0];
    if (first) points.push(first);
  }
  function move(e: ThreeEvent<PointerEvent>) {
    if (!drag.current) return;
    e.stopPropagation();
    if (drag.current === "centro") {
      const mesh = scene.getObjectByName("colorir-superficie");
      if (!mesh) return;
      raycaster.ray.copy(e.ray);
      const hit = raycaster.intersectObject(mesh, false)[0];
      if (hit) onForma({ ...f, centro: hit.point.toArray() as Vec3 });
      return;
    }
    const plane = new Plane().setFromNormalAndCoplanarPoint(
        new Vector3(...f.camera),
        new Vector3(...f.centro),
      ),
      point = e.ray.intersectPlane(plane, new Vector3());
    if (!point) return;
    {
      const d = point.sub(new Vector3(...f.centro)),
        a = (f.rotacao * Math.PI) / 180,
        u =
          d.dot(new Vector3(...f.direita)) * Math.cos(a) +
          d.dot(new Vector3(...f.cima)) * Math.sin(a),
        v =
          -d.dot(new Vector3(...f.direita)) * Math.sin(a) +
          d.dot(new Vector3(...f.cima)) * Math.cos(a);
      onForma({
        ...f,
        largura: Math.max(0.1, Math.abs(u) * 2),
        altura: Math.max(0.1, Math.abs(v) * 2),
      });
    }
  }
  const handle = (type: "centro" | "tamanho") => ({
    onPointerDown: (e: ThreeEvent<PointerEvent>) => {
      e.stopPropagation();
      drag.current = type;
      const target = e.target;
      if (target && "setPointerCapture" in target)
        (target as HTMLElement).setPointerCapture(e.pointerId);
    },
    onPointerMove: move,
    onPointerUp: (e: ThreeEvent<PointerEvent>) => {
      e.stopPropagation();
      drag.current = null;
      const target = e.target;
      if (target && "releasePointerCapture" in target)
        (target as HTMLElement).releasePointerCapture(e.pointerId);
    },
  });
  return (
    <>
      <Line points={points} color={cor} lineWidth={2} depthTest={false} />
      <mesh position={pontoForma(f, 0, 0)} {...handle("centro")}>
        <sphereGeometry args={[Math.max(0.04, f.largura * 0.035), 12, 8]} />
        <meshBasicMaterial color={cor} depthTest={false} />
      </mesh>
      <mesh position={pontoForma(f, f.largura / 2, f.altura / 2)} {...handle("tamanho")}>
        <sphereGeometry args={[Math.max(0.04, f.largura * 0.035), 12, 8]} />
        <meshBasicMaterial color={cor} depthTest={false} />
      </mesh>
      {espelho && (
        <FormaCena
          forma={espelharForma(f, centroX)}
          onForma={() => {}}
          cor={cor}
          espelho={false}
          centroX={centroX}
        />
      )}
    </>
  );
}
