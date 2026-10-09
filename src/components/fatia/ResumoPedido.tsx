import { resumoPedido } from "@/lib/resumo-pedido";

/** Roteiro + date line and small chips with what the user chose. */
export function ResumoPedidoLinha({ opcoes, roteiro, data, extra }: { opcoes: unknown; roteiro: string; data?: string | undefined; extra?: string | undefined }) {
  const r = resumoPedido(opcoes, roteiro);
  return (
    <div className="mt-1 space-y-1">
      <p className="text-xs text-muted-foreground">{r.roteiro}{extra ? ` · ${extra}` : ""}{data ? ` · ${new Date(data).toLocaleDateString("pt-BR")}` : ""}</p>
      {r.chips.length > 0 && (
        <ul className="flex flex-wrap gap-1" aria-label="O que você pediu">
          {r.chips.map((c) => <li key={c} className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-foreground">{c}</li>)}
        </ul>
      )}
    </div>
  );
}
