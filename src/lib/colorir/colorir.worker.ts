import { lerSTL, prepararMalha, segmentar } from "./malha";
import type { Malha } from "./malha";
import {
  Historico,
  folha,
  lerFace,
  escreverFace,
  triangulo,
  folhas,
  coresUsadas,
  trocarSlot,
} from "./pintura";
import type { Pintura, Alteracao, No } from "./pintura";
import { pintarRegiao, pintarPincel, pintarFormas } from "./operacoes";
import { watershed } from "./watershed";
import { exportar3mf } from "./exportar3mf";
import type { Comando, Resposta, DetalhesRender } from "./protocolo";
import { construirBVH } from "./bvh";
import { montarPrevia, diferencaPintura } from "./ia-previa";
import type { CorSlot } from "./paleta";
import { refinarMistas, regioesLinha, facesDeBorda } from "./ia-segmentacao";
const scope = self as unknown as {
  postMessage: (r: Resposta, transfer?: Transferable[]) => void;
  onmessage: ((e: MessageEvent<Comando>) => void) | null;
};
let malha: Malha | null = null,
  regioes: Uint32Array = new Uint32Array(),
  pintura: Pintura = { slots: new Uint8Array(), detalhes: new Map() },
  historico = new Historico(),
  traco: Map<number, Alteracao> | null = null;
let previaIA: Pintura | null = null;
// Photo-colouring segmentation only: never replaces the manual tool's regions.
let ia: { regioes: Uint32Array; linhas: Set<number> } | null = null;
let paletasIA = new WeakMap<object, { antes: CorSlot[]; depois: CorSlot[] }>();
const send = (r: Resposta, t: Transferable[] = []) => scope.postMessage(r, t);
function renderDetalhes(p = pintura): DetalhesRender {
  let total = 0;
  p.detalhes.forEach((n, f) =>
    folhas(n, triangulo(malha?.posicoes ?? new Float32Array(), f), () => total++),
  );
  const posicoes = new Float32Array(total * 9),
    slots = new Uint8Array(total),
    faces = new Uint32Array(total);
  let i = 0;
  p.detalhes.forEach((n, f) =>
    folhas(n, triangulo(malha?.posicoes ?? new Float32Array(), f), (slot, t) => {
      for (let j = 0; j < 3; j++) posicoes.set(t[j] ?? [0, 0, 0], i * 9 + j * 3);
      slots[i] = slot;
      faces[i++] = f;
    }),
  );
  return { posicoes, slots, faces, bvh: construirBVH(posicoes) };
}
function publicar(diff: Alteracao[], trees: boolean, paleta?: CorSlot[]) {
  const faces = new Uint32Array(diff.map((d) => d.face)),
    slots = new Uint8Array(diff.map((d) => pintura.slots[d.face] ?? 1)),
    detalhes = trees ? renderDetalhes() : null;
  send({
    tipo: "pintura",
    faces,
    slots,
    detalhes,
    usadas: coresUsadas(pintura),
    desfazer: historico.desfazer.length > 0,
    refazer: historico.refazer.length > 0,
    ...(paleta ? { paleta } : {}),
  });
}
function pintar(select: (f: number, antes: No) => No) {
  if (!malha) return;
  const diff: Alteracao[] = [];
  let trees = false;
  for (let f = 0; f < pintura.slots.length; f++) {
    const antes = lerFace(pintura, f),
      depois = select(f, antes);
    if (antes === depois || ("slot" in antes && "slot" in depois && antes.slot === depois.slot))
      continue;
    trees ||= !("slot" in antes) || !("slot" in depois);
    escreverFace(pintura, f, depois);
    const d = { face: f, antes, depois };
    diff.push(d);
    if (traco) {
      const prev = traco.get(f);
      traco.set(f, { face: f, antes: prev?.antes ?? antes, depois });
    }
  }
  if (!traco) historico.registrar(diff);
  publicar(diff, trees);
}
scope.onmessage = (event) => {
  try {
    const cmd = event.data;
    if (cmd.tipo === "ler") {
      send({ tipo: "progresso", etapa: "Lendo", percentual: 5 });
      malha = prepararMalha(lerSTL(cmd.buffer), (etapa, percentual) =>
        send({ tipo: "progresso", etapa, percentual }),
      );
      send({ tipo: "progresso", etapa: "Regiões", percentual: 85 });
      regioes = segmentar(malha, cmd.sensibilidade);
      pintura = { slots: new Uint8Array(malha.indices.length / 3).fill(1), detalhes: new Map() };
      historico = new Historico();
      traco = null;
      previaIA = null;
      ia = null;
      paletasIA = new WeakMap();
      const bvh = construirBVH(malha.posicoes),
        posicoes = malha.posicoes.slice(),
        normais = malha.normais.slice();
      send({ tipo: "malha", posicoes, normais, regioes: regioes.slice(), bvh }, [
        posicoes.buffer,
        normais.buffer,
      ]);
      return;
    }
    if (!malha) throw new Error("Envie uma peça primeiro.");
    const m = malha;
    switch (cmd.tipo) {
      case "previaIA":
        previaIA = ia ? montarPrevia(m, ia.regioes, pintura, cmd.plano, cmd.semRosto, ia.linhas) : montarPrevia(m, regioes, pintura, cmd.plano, cmd.semRosto);
        send({ tipo: "previaIA", slots: previaIA.slots.slice(), detalhes: renderDetalhes(previaIA) });
        break;
      case "aplicarIA": {
        if (!previaIA) throw new Error("A prévia ainda não está pronta.");
        const diff = diferencaPintura(pintura, previaIA);
        // Even identical slot indices can have a new palette: retain one undo step.
        if (!diff.length && pintura.slots.length) diff.push({ face: 0, antes: lerFace(pintura, 0), depois: lerFace(previaIA, 0) });
        pintura = previaIA;
        previaIA = null;
        historico.registrar(diff);
        const passo = historico.desfazer.at(-1);
        if (passo && diff.length) paletasIA.set(passo, { antes: cmd.paletaAntes, depois: cmd.paletaDepois });
        publicar(diff, true);
        break;
      }
      case "regioesIA": {
        const fina = segmentar(m, 3), r = refinarMistas(m, regioes, fina), linhas = regioesLinha(m, r);
        ia = { regioes: r, linhas };
        send({ tipo: "regioesIA", regioes: r.slice(), linhas: [...linhas], borda: facesDeBorda(m, r) });
        break;
      }
      case "descartarIA":
        previaIA = null;
        send({ tipo: "descartadaIA" });
        break;
      case "segmentar":
        send({ tipo: "progresso", etapa: "Regiões", percentual: 85 });
        regioes = segmentar(m, cmd.sensibilidade);
        ia = null;
        send({ tipo: "regioes", regioes: regioes.slice() });
        break;
      case "inicioTraco":
        traco = new Map();
        break;
      case "fimTraco": {
        const diff = [...(traco?.values() ?? [])];
        traco = null;
        historico.registrar(diff);
        publicar([], false);
        break;
      }
      case "balde":
        pintar((f, n) => pintarRegiao(f, n, regioes, cmd.face, cmd.slot));
        break;
      case "pincel":
        pintar((f, n) => pintarPincel(m, f, n, cmd.ponto, cmd.camera, cmd.raio, cmd.slot));
        break;
      case "sementes": {
        const slots = watershed(m, regioes, cmd.sementes);
        pintar((f, n) => (slots[f] ? folha(slots[f] ?? 1) : n));
        break;
      }
      case "forma":
        pintar((f, n) => pintarFormas(m, f, n, cmd.formas, cmd.slot));
        break;
      case "juntar":
        pintar((_f, n) => trocarSlot(n, cmd.a, cmd.b));
        break;
      case "historico": {
        const passo = (cmd.refazer ? historico.refazer : historico.desfazer).at(-1);
        const cores = passo ? paletasIA.get(passo) : undefined;
        const diff = historico.voltar(pintura, cmd.refazer);
        publicar(
          diff,
          diff.some((d) => !("slot" in d.antes) || !("slot" in d.depois)),
          cores ? (cmd.refazer ? cores.depois : cores.antes) : undefined,
        );
        break;
      }
      case "exportar": {
        const blob = exportar3mf(m, pintura, (n) =>
          send({ tipo: "progresso", etapa: "Exportando", percentual: n }),
        );
        send({ tipo: "exportado", blob, usadas: coresUsadas(pintura) });
        break;
      }
    }
  } catch (err) {
    send({
      tipo: "erro",
      mensagem: err instanceof Error ? err.message : "Não foi possível processar esta peça.",
    });
  }
};
