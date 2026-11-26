import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { caminhoOriginal } from "@/lib/nomes";
import { nomeColorido } from "@/lib/colorir/exportar3mf";
export function useSaidaColorida(
  userId: string,
  nome: string,
  exportar: () => Promise<{ blob: Blob; usadas: number[] }>,
) {
  const [salvando, setSalvando] = useState(false),
    [aviso, setAviso] = useState<number | null>(null),
    navigate = useNavigate(),
    qc = useQueryClient();
  async function baixar() {
    try {
      const { blob, usadas } = await exportar(),
        url = URL.createObjectURL(blob),
        a = document.createElement("a");
      a.href = url;
      a.download = nomeColorido(nome);
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
      setAviso(Math.max(...usadas));
    } catch {
      /* Worker already presents actionable errors. */
    }
  }
  async function analisar() {
    setSalvando(true);
    let path: string | null = null;
    try {
      const { blob } = await exportar(),
        filename = nomeColorido(nome);
      path = caminhoOriginal(userId, crypto.randomUUID(), "3mf");
      const { error: upload } = await supabase.storage
        .from("pecas")
        .upload(path, blob, { contentType: "application/octet-stream", upsert: false });
      if (upload)
        throw new Error(
          "Não foi possível enviar a peça. Sua pintura continua aqui; tente novamente.",
        );
      const { data, error } = await supabase
        .from("pecas")
        .insert({
          nome: (nome.replace(/\.stl$/i, "") + " (colorido)").slice(0, 120),
          arquivo_original_path: path,
          nome_arquivo_original: filename,
        })
        .select("id")
        .single();
      if (error || !data) {
        await supabase.storage.from("pecas").remove([path]);
        path = null;
        throw new Error("Não foi possível guardar a peça para a análise. Tente novamente.");
      }
      qc.invalidateQueries({ queryKey: ["biblioteca"] });
      navigate({ to: "/app/nova-analise", search: { peca: data.id } });
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Não foi possível enviar a peça. Tente novamente.",
      );
    } finally {
      setSalvando(false);
    }
  }
  return { baixar, analisar, salvando, aviso };
}
