import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { estimativasQuery, precosQuery } from "@/lib/queries";
import { custoApiUSD, formatBRL, formatUSD, usoPlano, type Motor, type Roteiro } from "@/lib/fatia";
import { Input } from "@/components/ui/input";

/** Short cost text for compact places (mobile summary bar). */
export function useCustoCurto(roteiro: Roteiro | null, motor: Motor | null): string {
  const { data: est = [] } = useQuery(estimativasQuery);
  const { data: precos = [] } = useQuery(precosQuery);
  const e = est.find((x) => x.roteiro === roteiro);
  if (!e || !motor) return "—";
  if (motor === "assinatura") return `Uso ${usoPlano(e.tokens_entrada_tipicos)} do plano`;
  const p = precos[0];
  return p ? formatUSD(custoApiUSD(e, p)) : "Preço a configurar";
}

export function CostCard({ roteiro, motor }: { roteiro: Roteiro | null; motor: Motor | null }) {
  const { data: est = [] } = useQuery(estimativasQuery);
  const { data: precos = [] } = useQuery(precosQuery);
  const [cambio, setCambio] = useState("5,50");
  const e = est.find((x) => x.roteiro === roteiro);
  const taxa = Number(cambio.replace(",", "."));

  let corpo: React.ReactNode = <p className="text-sm text-muted-foreground">Escolha o roteiro e o motor.</p>;
  if (e && motor === "assinatura") {
    corpo = <p className="text-lg font-bold">Uso {usoPlano(e.tokens_entrada_tipicos)} do plano, sem cobrança extra</p>;
  } else if (e && motor === "api") {
    const p = precos[0];
    if (!p) corpo = <p className="text-lg font-bold">Preço a configurar</p>;
    else {
      const usd = custoApiUSD(e, p);
      corpo = (
        <div className="space-y-2">
          <div className="flex flex-wrap items-baseline gap-x-3">
            <p className="text-2xl font-bold tabular">{formatUSD(usd)}</p>
            <p className="text-sm tabular text-muted-foreground">{Number.isFinite(taxa) && taxa > 0 ? formatBRL(usd * taxa) : "—"}</p>
          </div>
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            Câmbio R$/US$
            <Input value={cambio} onChange={(ev) => setCambio(ev.target.value)} className="h-9 w-20" inputMode="decimal" />
          </label>
        </div>
      );
    }
  }
  return (
    <div className="rounded-2xl bg-gradient-to-br from-primary/12 to-primary/4 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-primary-ink">Custo estimado</p>
      <div className="mt-1.5">{corpo}</div>
      {e && <p className="mt-2 text-xs text-muted-foreground">Base: ~{e.fatiamentos_tipicos} fatiamentos, {e.tokens_entrada_tipicos.toLocaleString("pt-BR")} tokens de entrada e {e.tokens_saida_tipicos.toLocaleString("pt-BR")} de saída.</p>}
    </div>
  );
}
