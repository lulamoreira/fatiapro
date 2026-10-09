import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { statusVendas } from "@/lib/vendas.functions";

/** Whether credit sales are paused (UI only — criarCompra enforces it on the server). */
export function useStatusVendas() {
  const fn = useServerFn(statusVendas);
  return useQuery({ queryKey: ["status-vendas"], queryFn: () => fn(), staleTime: 60_000 });
}
