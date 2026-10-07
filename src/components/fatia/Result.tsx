import { CheckCircle2, AlertTriangle } from "lucide-react";
import { formatDuracao, formatGramas, formatUSD } from "@/lib/fatia";

export interface ResultadoConteudo {
  final?: { segundos?: number; gramas?: number };
  tabela?: { colunas: string[]; linhas: (string | number)[][] };
  riscos?: string[];
  itens_checklist?: { item: string; status: "ok" | "atencao"; detalhe?: string }[];
  conclusao?: string;
}

export function Result({ c, motor, custo }: { c: ResultadoConteudo; motor: string; custo: unknown }) {
  const usd = (custo as { usd?: number } | null)?.usd;
  return (
    <section className="space-y-5" aria-label="Resultado">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {c.final && (
          <div className="rounded-2xl border border-success bg-success/10 p-4 sm:col-span-2">
            <p className="text-xs font-medium text-muted-foreground">Resultado real</p>
            <p className="mt-1 font-display text-3xl font-bold tabular">{formatDuracao(c.final.segundos)}</p>
            <p className="text-sm text-muted-foreground tabular">{formatGramas(c.final.gramas)}</p>
          </div>
        )}
        <div className="rounded-2xl border bg-card p-4">
          <p className="text-xs font-medium text-muted-foreground">Custo real</p>
          <p className="mt-1 font-display text-xl font-bold tabular">{motor === "assinatura" ? "uso do plano" : typeof usd === "number" ? formatUSD(usd) : "—"}</p>
        </div>
      </div>

      {c.tabela && c.tabela.colunas?.length > 0 && (
        <div className="overflow-x-auto rounded-2xl border bg-card">
          <table className="w-full text-sm">
            <thead className="border-b text-left text-muted-foreground"><tr>{c.tabela.colunas.map((h) => <th key={h} className="p-3 font-medium">{h}</th>)}</tr></thead>
            <tbody>
              {c.tabela.linhas?.map((l, i) => (
                <tr key={`${i}-${String(l[0])}`} className="border-b last:border-0">{l.map((v, j) => <td key={`${c.tabela!.colunas[j] ?? j}`} className="p-3 tabular">{String(v)}</td>)}</tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {c.itens_checklist?.length ? (
        <ul className="divide-y rounded-2xl border bg-card">
          {c.itens_checklist.map((it) => (
            <li key={it.item} className="flex items-start gap-3 p-4">
              {it.status === "ok" ? <CheckCircle2 className="size-5 shrink-0 text-success" aria-label="ok" /> : <AlertTriangle className="size-5 shrink-0 text-warning" aria-label="atenção" />}
              <div><p className="font-medium">{it.item}</p>{it.detalhe && <p className="text-sm text-muted-foreground">{it.detalhe}</p>}</div>
            </li>
          ))}
        </ul>
      ) : null}
      {c.conclusao && <p className="rounded-2xl bg-accent p-4 text-sm">{c.conclusao}</p>}

      {c.riscos?.length ? (
        <div className="rounded-2xl border p-4">
          <h3 className="text-sm font-semibold">Riscos</h3>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">{c.riscos.slice(0, 3).map((r) => <li key={r}>{r}</li>)}</ul>
        </div>
      ) : null}
    </section>
  );
}
