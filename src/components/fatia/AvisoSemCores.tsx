import { Info } from "lucide-react";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export type FormatoSemCores = "STL" | "STEP";

/**
 * Retorna o formato "sem cores" do arquivo (STL ou STEP) ou null quando o
 * arquivo guarda cores (ou não tem extensão conhecida).
 */
export function formatoSemCores(nomeArquivo: string): FormatoSemCores | null {
  const ext = nomeArquivo.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "stl") return "STL";
  if (ext === "step" || ext === "stp") return "STEP";
  return null;
}

export interface AvisoSemCoresProps extends ComponentProps<"div"> {
  formato: FormatoSemCores | null;
  onTrocar: () => void;
}

export function AvisoSemCores({ formato, onTrocar, className, ...props }: AvisoSemCoresProps) {
  if (!formato) return null;
  return (
    <div
      {...props}
      role="status"
      className={cn("flex items-start gap-3 rounded-xl border border-warning/30 bg-warning/15 p-4 backdrop-blur-md", className)}
    >
      <Info className="mt-0.5 size-5 shrink-0 text-warning-ink" aria-hidden />
      <div className="min-w-0 space-y-1 text-sm">
        <p className="font-semibold text-warning-ink">Este arquivo não guarda cores</p>
        <p className="text-foreground/90">
          Você está enviando um arquivo {formato}. Ele tem só a forma da peça — se a sua peça é colorida (várias cores
          pintadas), envie o arquivo .3mf, que guarda as cores. Se a peça é de uma cor só, pode seguir normalmente.
        </p>
        <button
          type="button"
          onClick={onTrocar}
          className="rounded text-xs font-semibold text-warning-ink underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          Trocar arquivo
        </button>
      </div>
    </div>
  );
}
