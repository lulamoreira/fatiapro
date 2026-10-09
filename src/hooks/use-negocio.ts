import { queryOptions, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/** The signed-in user's business row (RLS: own row only); null when not configured yet. */
export const negocioQuery = queryOptions({
  queryKey: ["negocio"],
  queryFn: async () => {
    const { data, error } = await supabase.from("negocio").select("user_id, nome, documento, email, whatsapp, cidade, logo_path").maybeSingle();
    if (error) throw error;
    return data;
  },
  staleTime: 60_000,
});

export const useNegocio = () => useQuery(negocioQuery);
