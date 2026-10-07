import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Keeps device data fresh via Realtime UPDATEs on `devices`.
 * RLS ensures only the user's own devices are delivered. The 15 s
 * refetchInterval on devicesQuery is the fallback.
 */
export function useDevicesLive(): void {
  const qc = useQueryClient();
  useEffect(() => {
    const ch = supabase
      .channel(`devices-live-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "devices" }, () => {
        qc.invalidateQueries({ queryKey: ["devices"] });
        qc.invalidateQueries({ queryKey: ["device_sinal"] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [qc]);
}
