/**
 * Browser data access (RLS-scoped). Every list query uses count:'exact',
 * .range() and a stable order (criado_em desc, id desc).
 */
import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const DEVICE_COLS = "id, user_id, nome, sistema, versao_ponte, ultimo_contato, relatorio, limite_gasto_usd, revogado, usos_claude, criado_em";

export const devicesQuery = queryOptions({
  queryKey: ["devices"],
  refetchInterval: 15_000, // fallback; Realtime (useDevicesLive) is primary
  queryFn: async () => {
    const { data, error } = await supabase
      .from("devices")
      .select(DEVICE_COLS, { count: "exact" })
      .eq("revogado", false)
      .order("criado_em", { ascending: false })
      .order("id", { ascending: false })
      .range(0, 49);
    if (error) throw error;
    return data;
  },
});
export type DeviceRow = Awaited<ReturnType<NonNullable<typeof devicesQuery.queryFn>>>[number];

export const estimativasQuery = queryOptions({
  queryKey: ["estimativas"],
  staleTime: 5 * 60_000,
  queryFn: async () => {
    const { data, error } = await supabase.from("estimativas_roteiro").select("*", { count: "exact" }).order("roteiro").range(0, 49);
    if (error) throw error;
    return data;
  },
});

export const precosQuery = queryOptions({
  queryKey: ["price_table"],
  staleTime: 5 * 60_000,
  queryFn: async () => {
    const { data, error } = await supabase.from("price_table").select("*", { count: "exact" }).order("modelo").range(0, 99);
    if (error) throw error;
    return data;
  },
});

export const presetsQuery = queryOptions({
  queryKey: ["presets"],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("presets")
      .select("*", { count: "exact" })
      .order("criado_em", { ascending: false })
      .order("id", { ascending: false })
      .range(0, 99);
    if (error) throw error;
    return data;
  },
});

export const jobQuery = (id: string) =>
  queryOptions({
    queryKey: ["job", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("jobs").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

export const jobEventsQuery = (id: string) =>
  queryOptions({
    queryKey: ["job_events", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("job_events")
        .select("*", { count: "exact" })
        .eq("job_id", id)
        .order("criado_em", { ascending: false })
        .order("id", { ascending: false })
        .range(0, 499);
      if (error) throw error;
      return [...data].reverse();
    },
  });

export const PAGE_SIZE = 25;
export const historicoQuery = (page: number) =>
  queryOptions({
    queryKey: ["historico", page],
    queryFn: async () => {
      const from = page * PAGE_SIZE;
      const { data, error, count } = await supabase
        .from("jobs")
        .select("*", { count: "exact" })
        .order("criado_em", { ascending: false })
        .order("id", { ascending: false })
        .range(from, from + PAGE_SIZE - 1);
      if (error) throw error;
      return { rows: data, total: count ?? 0 };
    },
  });

export const resumoMesQuery = queryOptions({
  queryKey: ["resumo_mes"],
  queryFn: async () => {
    const inicio = new Date();
    inicio.setDate(1);
    inicio.setHours(0, 0, 0, 0);
    let usd = 0;
    let assinatura = 0;
    const step = 1000;
    for (let from = 0; ; from += step) {
      const { data, error, count } = await supabase
        .from("jobs")
        .select("id, motor, custo_real", { count: "exact" })
        .gte("criado_em", inicio.toISOString())
        .order("criado_em", { ascending: false })
        .order("id", { ascending: false })
        .range(from, from + step - 1);
      if (error) throw error;
      for (const j of data) {
        if (j.motor === "api") {
          const c = j.custo_real as { usd?: unknown } | null;
          if (c && typeof c.usd === "number") usd += c.usd;
        } else assinatura += 1;
      }
      if (from + step >= (count ?? 0)) break;
    }
    return { usd, assinatura };
  },
});
