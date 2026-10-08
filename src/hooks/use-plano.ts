import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { meuPlano } from "@/lib/plano.functions";

/** Caller's plan summary (credits, trial, courtesy). Refetched after each analysis. */
export function usePlano() {
  const fn = useServerFn(meuPlano);
  return useQuery({ queryKey: ["meu-plano"], queryFn: () => fn(), staleTime: 30_000 });
}
