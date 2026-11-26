import type { Forma } from "./formas";
import type { Vec3 } from "./pintura";
import type { Semente } from "./watershed";
import type { SerializedBVH } from "three-mesh-bvh";
export type Comando =
  | { tipo: "ler"; buffer: ArrayBuffer; sensibilidade: number }
  | { tipo: "segmentar"; sensibilidade: number }
  | { tipo: "balde"; face: number; slot: number }
  | { tipo: "pincel"; ponto: Vec3; camera: Vec3; raio: number; slot: number }
  | { tipo: "forma"; formas: Forma[]; slot: number }
  | { tipo: "sementes"; sementes: Semente[] }
  | { tipo: "juntar"; a: number; b: number }
  | { tipo: "historico"; refazer: boolean }
  | { tipo: "exportar" }
  | { tipo: "inicioTraco" }
  | { tipo: "fimTraco" };
export interface DetalhesRender {
  posicoes: Float32Array;
  slots: Uint8Array;
  faces: Uint32Array;
  bvh: SerializedBVH | null;
}
export type Resposta =
  | { tipo: "progresso"; etapa: string; percentual: number }
  | {
      tipo: "malha";
      posicoes: Float32Array;
      normais: Float32Array;
      regioes: Uint32Array;
      bvh: SerializedBVH | null;
    }
  | { tipo: "regioes"; regioes: Uint32Array }
  | {
      tipo: "pintura";
      faces: Uint32Array;
      slots: Uint8Array;
      detalhes: DetalhesRender | null;
      usadas: number[];
      desfazer: boolean;
      refazer: boolean;
    }
  | { tipo: "exportado"; blob: Blob; usadas: number[] }
  | { tipo: "erro"; mensagem: string };
