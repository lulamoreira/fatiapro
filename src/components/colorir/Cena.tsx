import { useEffect, useMemo, useRef, useState } from "react";
import type { ComponentRef } from "react";
import { Canvas, useThree, useFrame } from "@react-three/fiber";
import type { ThreeEvent } from "@react-three/fiber";
import { OrbitControls, Environment, Lightformer } from "@react-three/drei";
import { Box3, Vector3, OrthographicCamera, Quaternion } from "three";
import type { CorSlot } from "@/lib/colorir/paleta";
import type { Forma } from "@/lib/colorir/formas";
import type { Vec3 } from "@/lib/colorir/pintura";
import type { Semente } from "@/lib/colorir/watershed";
import type { DadosCena } from "./useColorir";
import type { Ferramenta } from "./Ferramentas";
import { Geometria } from "./Geometria";
import { FormaCena } from "./FormaCena";
export interface CliquePeca {
  face: number;
  slot: number;
  ponto: Vec3;
  camera: Vec3;
  direita: Vec3;
  cima: Vec3;
  arrasto: boolean;
}
export interface Vista {
  id: number;
  nome: string;
  face: number | null;
}
export interface CenaProps {
  dados: DadosCena;
  paleta: CorSlot[];
  tool: Ferramenta;
  verRegioes: boolean;
  vista: Vista;
  onHit: (c: CliquePeca) => void;
  onFim: () => void;
  forma: Forma;
  onForma: (f: Forma) => void;
  posicionada: boolean;
  espelho: boolean;
  seeds: Semente[];
  disabled: boolean;
}
export function Cena(p: CenaProps) {
  const wrapper = useRef<HTMLDivElement>(null);
  return (
    <div ref={wrapper} className="h-full min-h-96 w-full">
      <Canvas
        orthographic
        frameloop="demand"
        dpr={[1, 1.5]}
        camera={{ position: [0, -100, 60], up: [0, 0, 1], near: 0.01, far: 100000 }}
        onCreated={({ raycaster }) => {
          raycaster.firstHitOnly = true;
        }}
      >
        <SceneContent {...p} />
        <Pronta onReady={() => wrapper.current?.setAttribute("data-scene-ready", "true")} />
      </Canvas>
    </div>
  );
}
function Pronta({ onReady }: { onReady: () => void }) {
  const ready = useRef(false);
  useFrame(() => {
    if (!ready.current) {
      ready.current = true;
      requestAnimationFrame(onReady);
    }
  });
  return null;
}
function SceneContent(p: CenaProps) {
  const { camera, size, invalidate, gl } = useThree(),
    controls = useRef<ComponentRef<typeof OrbitControls>>(null),
    [hover, setHover] = useState(-1);
  const bounds = useMemo(() => {
    const b = new Box3();
    for (let i = 0; i < p.dados.posicoes.length; i += 3)
      b.expandByPoint(
        new Vector3(p.dados.posicoes[i], p.dados.posicoes[i + 1], p.dados.posicoes[i + 2]),
      );
    return b;
  }, [p.dados.posicoes]);
  useEffect(() => {
    if (!(camera instanceof OrthographicCamera)) return;
    const box = bounds.clone();
    if (p.vista.nome === "close" && p.vista.face !== null) {
      box.makeEmpty();
      const reg = p.dados.regioes[p.vista.face];
      for (let f = 0; f < p.dados.regioes.length; f++)
        if (p.dados.regioes[f] === reg)
          for (let v = 0; v < 3; v++) {
            const i = f * 9 + v * 3;
            box.expandByPoint(
              new Vector3(p.dados.posicoes[i], p.dados.posicoes[i + 1], p.dados.posicoes[i + 2]),
            );
          }
    }
    const center = box.getCenter(new Vector3()),
      extent = box.getSize(new Vector3()),
      diag = Math.max(extent.length(), 0.1),
      distance = Math.max(bounds.getSize(new Vector3()).length() * 2, 10);
    let dir = new Vector3();
    const views: Record<string, Vec3> = {
      frente: [0, -1, 0],
      costas: [0, 1, 0],
      esquerda: [-1, 0, 0],
      direita: [1, 0, 0],
      topo: [0, 0, 1],
    };
    const chosen = views[p.vista.nome];
    if (chosen) dir.set(...chosen);
    else
      dir
        .copy(camera.position)
        .sub(controls.current?.target ?? center)
        .normalize();
    if (dir.lengthSq() < 0.1) dir.set(0, -1, 0);
    camera.up.set(0, 0, 1);
    if (p.vista.nome === "topo") camera.up.set(0, 1, 0);
    camera.position.copy(center).addScaledVector(dir, distance);
    camera.lookAt(center);
    camera.zoom =
      Math.min(size.width, size.height) / (diag * (p.vista.nome === "close" ? 1.08 : 1.3));
    camera.updateProjectionMatrix();
    controls.current?.target.copy(center);
    controls.current?.update();
    invalidate();
  }, [bounds, p.vista, size.width, size.height, camera, invalidate]);
  useEffect(() => {
    const onUp = () => p.onFim();
    gl.domElement.addEventListener("pointerup", onUp);
    gl.domElement.addEventListener("pointercancel", onUp);
    return () => {
      gl.domElement.removeEventListener("pointerup", onUp);
      gl.domElement.removeEventListener("pointercancel", onUp);
    };
  }, [gl, p.onFim]);
  function hit(e: ThreeEvent<PointerEvent>, face: number, slot: number, arrasto: boolean) {
    if (p.disabled || p.tool === "mover") return;
    const q = camera.getWorldQuaternion(new Quaternion()),
      direction = camera.getWorldDirection(new Vector3()).negate();
    p.onHit({
      face,
      slot,
      ponto: e.point.toArray() as Vec3,
      camera: direction.toArray() as Vec3,
      direita: new Vector3(1, 0, 0).applyQuaternion(q).toArray() as Vec3,
      cima: new Vector3(0, 1, 0).applyQuaternion(q).toArray() as Vec3,
      arrasto,
    });
  }
  return (
    <>
      <ambientLight intensity={1.15} />
      <directionalLight position={[50, -80, 100]} intensity={1.5} />
      <Environment resolution={32}>
        <Lightformer intensity={1} position={[0, 0, 100]} scale={[200, 200, 1]} />
        <Lightformer
          intensity={0.6}
          position={[-100, 0, 20]}
          rotation-y={Math.PI / 2}
          scale={[200, 200, 1]}
        />
      </Environment>
      <Geometria
        dados={p.dados}
        paleta={p.paleta}
        verRegioes={p.verRegioes}
        hover={hover}
        onHit={hit}
        onHover={(f) => setHover(f < 0 ? -1 : (p.dados.regioes[f] ?? -1))}
        onFim={p.onFim}
      />
      <OrbitControls
        ref={controls}
        makeDefault
        enableDamping
        enableRotate={p.tool === "mover"}
        enablePan={p.tool === "mover"}
        minZoom={0.01}
        maxZoom={100000}
      />
      {p.tool === "forma" && p.posicionada && (
        <FormaCena
          forma={p.forma}
          onForma={p.onForma}
          cor={p.paleta[0]?.cor ?? "#FFFFFF"}
          espelho={p.espelho}
          centroX={bounds.getCenter(new Vector3()).x}
        />
      )}
      {p.seeds.map((s) => (
        <mesh key={s.id} position={s.ponto} raycast={() => {}}>
          <sphereGeometry
            args={[Math.max(bounds.getSize(new Vector3()).length() * 0.003, 0.05), 12, 8]}
          />
          <meshBasicMaterial color={p.paleta[s.slot - 1]?.cor ?? "#FFFFFF"} depthTest={false} />
        </mesh>
      ))}
    </>
  );
}
