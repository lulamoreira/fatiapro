import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { maisAlta, type Plataforma } from "@/lib/ponte";

export interface PonteVersao {
  id: string; plataforma: Plataforma; versao: string; nome_arquivo: string; arquivo_path: string;
  tamanho_bytes: number; notas: string | null; publicada: boolean; publicada_por_assinatura?: boolean; criado_em: string;
}

/** Visible versions (published only for regular users; admins also see drafts via RLS). */
export function usePonteVersoes() {
  return useQuery({
    queryKey: ["ponte-versoes"],
    queryFn: async (): Promise<PonteVersao[]> => {
      const { data, error } = await supabase.from("ponte_versoes")
        .select("id,plataforma,versao,nome_arquivo,arquivo_path,tamanho_bytes,notas,publicada,publicada_por_assinatura,criado_em", { count: "exact" })
        .order("criado_em", { ascending: false }).order("id", { ascending: false }).range(0, 999);
      if (error) throw error;
      return (data ?? []) as PonteVersao[];
    },
    staleTime: 60_000,
  });
}

export function ultimaPublicada(rows: readonly PonteVersao[] | undefined, p: Plataforma) {
  return maisAlta((rows ?? []).filter((r) => r.publicada && r.plataforma === p));
}
