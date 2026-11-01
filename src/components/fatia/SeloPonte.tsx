import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Selo em destaque da versão da ponte, no cartão do topo da análise. */
export function SeloPonte({ versao, nome }: { versao?: string | null | undefined; nome?: string | null | undefined }): ReactNode {
  if (!versao) return null;
  const titulo = nome ? `Versão da ponte no computador ${nome}` : "Versão da ponte no computador";
  return (
    <span
      title={titulo}
      aria-label={titulo}
      className={cn(
        "inline-flex items-center rounded-full bg-primary px-2.5 py-0.5 text-xs font-semibold text-primary-foreground",
        "tabular-nums whitespace-nowrap",
      )}
    >
      Ponte {versao}
    </span>
  );
}
