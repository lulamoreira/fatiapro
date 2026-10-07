import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/** Whether the signed-in user is an app admin. UI hint only — the database enforces the rule. */
export function useIsAdmin(): boolean {
  const { data } = useQuery({
    queryKey: ["is-admin"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("is_admin");
      if (error) return false;
      return data === true;
    },
    staleTime: 5 * 60_000,
  });
  return data === true;
}
