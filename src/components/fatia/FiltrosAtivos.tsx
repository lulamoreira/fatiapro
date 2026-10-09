import { X } from "lucide-react";
import { ROTULO_FILTRO } from "@/lib/inicio";

/** Chips for the active URL filters plus "Limpar filtros". Renders nothing without filters. */
export function FiltrosAtivos({ valores, onLimpar }: { valores: (string | undefined)[]; onLimpar: () => void }) {
  const ativos = valores.filter((v): v is string => !!v);
  if (!ativos.length) return null;
  return (
    <div className="flex flex-wrap items-center gap-2" aria-label="Filtros ativos">
      {ativos.map((v) => (
        <span key={v} className="inline-flex items-center rounded-full bg-primary/12 px-3 py-1 text-xs font-semibold text-primary-ink">{ROTULO_FILTRO[v] ?? v}</span>
      ))}
      <button type="button" onClick={onLimpar} className="inline-flex min-h-8 items-center gap-1 rounded-full px-2 text-xs font-medium text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <X className="size-3.5" aria-hidden />Limpar filtros
      </button>
    </div>
  );
}
