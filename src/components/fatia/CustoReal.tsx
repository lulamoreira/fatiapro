import { useId, useState } from "react";
import { Segmented } from "@/components/fatia/Chip";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatUSD } from "@/lib/fatia";

export type MoedaCusto = "BRL" | "USD";
const MOEDAS: { id: MoedaCusto; label: string }[] = [
  { id: "BRL", label: "R$" },
  { id: "USD", label: "US$" },
];

/** Display-only conversion; never changes the recorded provider cost. */
export function custoEmReais(usd: number, cambio: string): number | null {
  const taxa = Number(cambio.trim().replace(",", "."));
  const valor = usd * taxa;
  return Number.isFinite(usd) && usd >= 0 && Number.isFinite(taxa) && taxa > 0 && Number.isFinite(valor) ? valor : null;
}

export function CustoReal({ motor, custo }: { motor: string; custo: unknown }) {
  const id = useId();
  const [moeda, setMoeda] = useState<MoedaCusto>("BRL");
  // Same editable reference rate used by the existing estimate card, not a live quote.
  const [cambio, setCambio] = useState("5,50");
  const usd = custo && typeof custo === "object" && "usd" in custo ? custo.usd : null;
  const temCusto = typeof usd === "number" && Number.isFinite(usd) && usd >= 0;
  const reais = temCusto ? custoEmReais(usd, cambio) : null;
  const assinatura = motor === "assinatura";
  const valor = assinatura ? "uso do plano" : !temCusto ? "—" : moeda === "USD" ? formatUSD(usd) : reais == null ? "—" : `≈ ${reais.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: reais > 0 && reais < 0.01 ? 4 : 2, maximumFractionDigits: reais > 0 && reais < 0.01 ? 4 : 2 })}`;

  return (
    <div className="min-w-0 space-y-3 rounded-2xl border bg-card p-4">
      <div>
        <p className="text-xs font-medium text-muted-foreground">Custo real</p>
        <p aria-live="polite" className="mt-1 break-words font-display text-xl font-bold tabular">{valor}</p>
      </div>
      {!assinatura && temCusto && (
        <>
          <Segmented label="Moeda do custo" options={MOEDAS} value={moeda} onChange={setMoeda} />
          {moeda === "BRL" && (
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <Label htmlFor={id} className="text-xs text-muted-foreground">Câmbio R$/US$</Label>
                <Input id={id} value={cambio} onChange={(e) => setCambio(e.target.value)} inputMode="decimal" aria-invalid={reais == null} aria-describedby={`${id}-nota`} className="h-9 w-24" />
              </div>
              <p id={`${id}-nota`} className="text-xs text-muted-foreground">Conversão aproximada · câmbio informado.</p>
              {reais == null && <p role="alert" className="text-xs text-destructive-ink">Informe um câmbio maior que zero.</p>}
            </div>
          )}
        </>
      )}
    </div>
  );
}