import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import type { Comando, Resposta, DetalhesRender } from "@/lib/colorir/protocolo";
import type { SerializedBVH } from "three-mesh-bvh";
import type { CorSlot } from "@/lib/colorir/paleta";
export interface DadosCena {
  posicoes: Float32Array;
  normais: Float32Array;
  regioes: Uint32Array;
  slots: Uint8Array;
  detalhes: DetalhesRender;
  alteradas: Uint32Array;
  revisao: number;
  bvh: SerializedBVH | null;
}
/** Photo-colouring regions (refined mixed regions), with boundary faces for the "conferir" outline. */
export interface SegmentacaoIA { regioes: Uint32Array; linhas: number[]; borda: Uint8Array }
const vazio: DetalhesRender = {
  posicoes: new Float32Array(),
  slots: new Uint8Array(),
  faces: new Uint32Array(),
  bvh: null,
};
export function useColorir() {
  const worker = useRef<Worker | null>(null),
    exportPromise = useRef<{
      resolve: (v: { blob: Blob; usadas: number[] }) => void;
      reject: (e: Error) => void;
    } | null>(null),
    segPromise = useRef<{ resolve: (v: SegmentacaoIA) => void; reject: (e: Error) => void } | null>(null);
  const [dados, setDados] = useState<DadosCena | null>(null),
    [previa, setPrevia] = useState<DadosCena | null>(null),
    [paletaHistorico, setPaletaHistorico] = useState<CorSlot[] | null>(null),
    [progresso, setProgresso] = useState<{ etapa: string; percentual: number } | null>(null),
    [ocupado, setOcupado] = useState(false),
    [usadas, setUsadas] = useState([1]),
    [undo, setUndo] = useState(false),
    [redo, setRedo] = useState(false);
  const tratar = useCallback((event: MessageEvent<Resposta>) => {
    const r = event.data;
    if (r.tipo === "progresso") {
      setProgresso({ etapa: r.etapa, percentual: r.percentual });
      return;
    }
    if (r.tipo === "malha") {
      setPrevia(null);
      setDados({
        ...r,
        slots: new Uint8Array(r.regioes.length).fill(1),
        detalhes: vazio,
        alteradas: new Uint32Array(),
        revisao: 0,
      });
      setUsadas([1]);
      setUndo(false);
      setRedo(false);
    }
    if (r.tipo === "regioes")
      setDados((d) => (d ? { ...d, regioes: r.regioes, revisao: d.revisao + 1 } : d));
    if (r.tipo === "pintura") {
      if (r.paleta) setPaletaHistorico(r.paleta);
      setPrevia(null);
      setDados((d) => {
        if (!d) return d;
        for (let i = 0; i < r.faces.length; i++) d.slots[r.faces[i] ?? 0] = r.slots[i] ?? 1;
        const alteradas = new Uint32Array(d.alteradas.length + r.faces.length);
        alteradas.set(d.alteradas);
        alteradas.set(r.faces, d.alteradas.length);
        return { ...d, alteradas, detalhes: r.detalhes ?? d.detalhes, revisao: d.revisao + 1 };
      });
      setUsadas(r.usadas);
      setUndo(r.desfazer);
      setRedo(r.refazer);
    }
    if (r.tipo === "previaIA") {
      setDados(d => {
        if (d) setPrevia({ ...d, slots: r.slots, detalhes: r.detalhes, alteradas: new Uint32Array(), revisao: d.revisao + 1 });
        return d;
      });
    }
    if (r.tipo === "descartadaIA") setPrevia(null);
    if (r.tipo === "regioesIA") {
      segPromise.current?.resolve({ regioes: r.regioes, linhas: r.linhas, borda: r.borda });
      segPromise.current = null;
    }
    if (r.tipo === "exportado") {
      exportPromise.current?.resolve(r);
      exportPromise.current = null;
    }
    if (r.tipo === "erro") {
      toast.error(r.mensagem);
      segPromise.current?.reject(new Error(r.mensagem));
      segPromise.current = null;
      exportPromise.current?.reject(new Error(r.mensagem));
      exportPromise.current = null;
    }
    setProgresso(null);
    setOcupado(false);
  }, []);
  const criar = useCallback(() => {
    worker.current?.terminate();
    const w = new Worker(new URL("../../lib/colorir/colorir.worker.ts", import.meta.url), {
      type: "module",
    });
    w.onmessage = tratar;
    w.onerror = () => {
      setOcupado(false);
      setProgresso(null);
      toast.error(
        "A peça excedeu a memória disponível ou não pôde ser processada. Tente um STL menor.",
      );
      exportPromise.current?.reject(new Error("Processamento interrompido."));
      exportPromise.current = null;
    };
    worker.current = w;
    return w;
  }, [tratar]);
  useEffect(
    () => () => {
      worker.current?.terminate();
      exportPromise.current?.reject(new Error("Página fechada."));
    },
    [],
  );
  const enviar = useCallback((cmd: Comando, busy = false) => {
    if (!worker.current) return;
    if (busy) setOcupado(true);
    worker.current.postMessage(cmd);
  }, []);
  const abrir = useCallback(
    async (file: File, sensibilidade: number) => {
      setOcupado(true);
      setDados(null);
      setPrevia(null);
      setProgresso({ etapa: "Lendo", percentual: 0 });
      try {
        const w = criar(),
          buffer = await file.arrayBuffer();
        if (worker.current !== w) return;
        w.postMessage({ tipo: "ler", buffer, sensibilidade } satisfies Comando, [buffer]);
      } catch {
        setOcupado(false);
        setProgresso(null);
        toast.error("Não foi possível ler este arquivo.");
      }
    },
    [criar],
  );
  const cancelar = useCallback(() => {
    worker.current?.terminate();
    worker.current = null;
    exportPromise.current?.reject(new Error("Operação cancelada."));
    exportPromise.current = null;
    setDados(null);
    setPrevia(null);
    setOcupado(false);
    setProgresso(null);
    setUndo(false);
    setRedo(false);
  }, []);
  const exportar = useCallback(
    () =>
      new Promise<{ blob: Blob; usadas: number[] }>((resolve, reject) => {
        if (!worker.current) {
          reject(new Error("Envie uma peça primeiro."));
          return;
        }
        if (exportPromise.current) {
          reject(new Error("Já existe uma exportação em andamento."));
          return;
        }
        exportPromise.current = { resolve, reject };
        setOcupado(true);
        worker.current.postMessage({ tipo: "exportar" } satisfies Comando);
      }),
    [],
  );
  const segmentarIA = useCallback(
    () =>
      new Promise<SegmentacaoIA>((resolve, reject) => {
        if (!worker.current) return reject(new Error("Envie uma peça primeiro."));
        segPromise.current = { resolve, reject };
        worker.current.postMessage({ tipo: "regioesIA" } satisfies Comando);
      }),
    [],
  );
  return { segmentarIA, dados, previa, paletaHistorico, progresso, ocupado, usadas, undo, redo, enviar, abrir, cancelar, exportar };
}
