import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouteContext } from "@tanstack/react-router";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

/** Profile state stays independent of business data and scoped to the current user. */
export function useEstadoPerfil() {
  const { user } = useRouteContext({ from: "/_authenticated" });
  const qc = useQueryClient();
  const queryKey = ["perfil-uf", user.id];
  const query = useQuery({
    queryKey,
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("uf").eq("id", user.id).maybeSingle();
      if (error) throw error;
      return data?.uf ?? null;
    },
    staleTime: 60_000,
  });
  const salvar = useMutation({
    mutationFn: async (uf: string | null) => {
      const { data, error } = await supabase.from("profiles").update({ uf }).eq("id", user.id).select("uf").single();
      if (error) throw error;
      return data.uf;
    },
    onSuccess: (uf) => qc.setQueryData(queryKey, uf),
    onError: () => { toast.error("Não foi possível salvar o estado. Tente novamente."); },
  });
  return { ...query, salvar };
}