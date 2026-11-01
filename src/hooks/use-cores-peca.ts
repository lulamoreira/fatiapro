import { useEffect, useState, type Dispatch, type SetStateAction } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { tamanhoArquivo } from "@/lib/storage";
import { leitorDeUrl } from "@/lib/miniatura-3mf";
import { coresDo3mf, lerMemoriaCores, tipoInicial, type Cor3mf } from "@/lib/cores-3mf";
import type { FormState } from "@/components/fatia/form";

/** Piece changes invalidate pending reads, including slow signed-URL requests. */
export function useCoresPeca(arquivo: File | null, path: string | null, usarAberta: boolean, setF: Dispatch<SetStateAction<FormState>>) {
  const [cores, setCores] = useState<Cor3mf[] | null>(null);
  const qc = useQueryClient();
  useEffect(() => {
    let cancelado = false;
    setCores(null);
    setF((f) => ({ ...f, filMistoCores: [] }));
    async function ler() {
      if (usarAberta) return null;
      if (arquivo) {
        if (!/\.3mf$/i.test(arquivo.name)) return null;
        return coresDo3mf(async (inicio, fim) => new Uint8Array(await arquivo.slice(inicio, fim + 1).arrayBuffer()), arquivo.size);
      }
      if (!path || !/\.3mf$/i.test(path)) return null;
      return qc.fetchQuery({
        queryKey: ["cores-peca", path], staleTime: 60_000,
        queryFn: async () => {
          const [tamanho, { data, error }] = await Promise.all([tamanhoArquivo(path), supabase.storage.from("pecas").createSignedUrl(path, 300)]);
          if (error || !data || !tamanho) return null;
          return coresDo3mf(leitorDeUrl(data.signedUrl), tamanho);
        },
      });
    }
    void ler().then((resultado) => {
      if (cancelado) return;
      setCores(resultado);
      if (!resultado || resultado.length < 2) return;
      const memoria = lerMemoriaCores();
      const linhas = resultado.map((c) => ({ slot: c.slot, tipo: tipoInicial(c.perfil, c.cor, memoria) }));
      const especial = linhas.some((l) => l.tipo !== "PLA");
      // Auto "Sim" only while unanswered; an explicit "Não" is respected.
      setF((f) => f.filMisto === true ? { ...f, filMistoCores: linhas } : f.filMisto === null && especial ? { ...f, filMisto: true, filMistoCores: linhas } : f);
    }).catch(() => { /* Reading colors is optional; leave the manual choices available. */ });
    return () => { cancelado = true; };
  }, [arquivo, path, usarAberta, qc, setF]);
  return cores;
}