import type { ReactNode } from "react";
import { Link, type LinkProps } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export type KpiTom = "normal" | "sucesso" | "atencao" | "alerta";

const TOM: Record<KpiTom, string> = {
  normal: "",
  sucesso: "border-success/40 bg-success/8",
  atencao: "border-warning/50 bg-warning/12",
  alerta: "border-destructive/40 bg-destructive/10",
};

export interface KpiProps {
  rotulo: string;
  valor: ReactNode;
  contexto?: ReactNode;
  /** Whole card is a link. Omit for number-only cards. */
  link?: LinkProps;
  tom?: KpiTom;
  pequeno?: boolean;
}

/** One KPI tile: small label, big tabular number, one context line, subtle arrow. */
export function Kpi({ rotulo, valor, contexto, link, tom = "normal", pequeno }: KpiProps) {
  const corpo = (
    <>
      <span className="flex items-start justify-between gap-2">
        <span className="text-xs font-semibold text-muted-foreground">{rotulo}</span>
        {link && <ArrowRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden />}
      </span>
      <span className={cn("mt-1 block font-bold tabular tracking-[-0.02em]", pequeno ? "text-xl" : "text-[28px] leading-tight")}>{valor}</span>
      {contexto && <span className="mt-0.5 block truncate text-xs text-muted-foreground">{contexto}</span>}
    </>
  );
  const cls = cn("group block min-w-0 rounded-2xl border bg-card p-4 shadow-sm", TOM[tom],
    link && "transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring");
  return link ? <Link {...link} className={cls}>{corpo}</Link> : <div className={cls}>{corpo}</div>;
}

export function Secao({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section aria-label={titulo} className="space-y-3">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{titulo}</h2>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{children}</div>
    </section>
  );
}

export function KpiSkeleton({ secoes = 3 }: { secoes?: number }) {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Carregando">
      {Array.from({ length: secoes }, (_, s) => (
        <div key={s} className="space-y-3">
          <Skeleton className="h-4 w-32 rounded" />
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-[104px] rounded-2xl" />)}
          </div>
        </div>
      ))}
    </div>
  );
}
