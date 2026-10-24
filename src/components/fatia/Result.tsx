import { CheckCircle2, AlertTriangle, Info } from "lucide-react";
import { formatDuracao, formatGramas } from "@/lib/fatia";
import { CustoReal } from "./CustoReal";
import { Tag } from "@/components/fatia/Chip";
import { MapaPlaca, type MapaPlacaDados } from "./MapaPlaca";

export interface ResultadoConteudo {
  final?: { segundos?: number; gramas?: number };
  tabela?: { colunas: string[]; linhas: (string | number)[][] };
  riscos?: string[];
  itens_checklist?: { item: string; status: "ok" | "atencao"; detalhe?: string }[];
  conclusao?: string;
  /** Só no roteiro "producao": totais do arquivo de produção. */
  producao?: { copias: number; placas: number; gramas_total?: number; estimado?: boolean; mapa?: MapaPlacaDados };
}

export function Result({ c, motor, custo }: { c: ResultadoConteudo; motor: string; custo: unknown }) {
  const prod = c.producao;
  const porPeca = prod && prod.copias > 0 && typeof c.final?.segundos === "number" ? c.final.segundos / prod.copias : null;
  return (
    <section className="space-y-5" aria-label="Resultado">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {c.final && prod && (
          <div className="rounded-2xl border border-success bg-success/10 p-4 sm:col-span-2">
            <p className="text-xs font-medium text-muted-foreground">Arquivo de produção pronto</p>
            <p className="mt-1 font-display text-3xl font-bold tabular">{prod.copias} peças em {prod.placas} {prod.placas === 1 ? "placa" : "placas"}</p>
            <p className="text-sm text-muted-foreground tabular">
              {formatDuracao(c.final.segundos)} e {formatGramas(c.final.gramas)} no total
              {porPeca != null && ` · ${formatDuracao(porPeca)} por peça`}
              {prod.estimado === true && <Tag tone="muted" className="ml-1 align-middle">estimado</Tag>}
            </p>
            {prod.mapa && <MapaPlaca mapa={prod.mapa} className="mx-auto mt-4" />}
          </div>
        )}
        {c.final && !prod && (
          <div className="rounded-2xl border border-success bg-success/10 p-4 sm:col-span-2">
            <p className="text-xs font-medium text-muted-foreground">Resultado real</p>
            <p className="mt-1 font-display text-3xl font-bold tabular">{formatDuracao(c.final.segundos)}</p>
            <p className="text-sm text-muted-foreground tabular">{formatGramas(c.final.gramas)}</p>
          </div>
        )}
        <CustoReal motor={motor} custo={custo} />
      </div>

      {prod?.estimado === true && (
        <p role="note" className="flex items-start gap-2 rounded-2xl bg-warning/15 p-4 text-sm text-warning-ink">
          <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
          Tempo e filamento estimados: a peça é muito detalhada para fatiar a placa cheia de uma vez. O arquivo vai pronto para o fatiador, mas sem fatiar — ao abrir, clique em Fatiar para ver o tempo exato.
        </p>
      )}

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
