import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface ChipProps extends Omit<ComponentProps<"button">, "children"> {
  selected?: boolean;
  badge?: ReactNode;
  children: ReactNode;
}

/** Pill for multi-select / priority options. Selected = aqua gradient. */
export function Chip({ selected, badge, className, children, ...props }: ChipProps) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      className={cn(
        "inline-flex min-h-11 items-center gap-1.5 rounded-full border px-4 py-1.5 text-sm font-medium transition-all duration-200 md:min-h-9",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        "disabled:cursor-not-allowed disabled:opacity-50",
        selected
          ? "bg-aqua border-transparent text-primary-foreground shadow-aqua"
          : "border-border bg-secondary text-foreground shadow-sm hover:bg-card",
        className,
      )}
      {...props}
    >
      {badge != null && (
        <span className={cn("flex size-5 items-center justify-center rounded-full text-[11px] font-bold", selected ? "bg-primary-foreground text-primary-ink" : "bg-muted")}>{badge}</span>
      )}
      {children}
    </button>
  );
}

export interface ChipGroupProps<T extends string> {
  options: readonly { id: T; label: string }[];
  value: T | null;
  onChange: (v: T) => void;
  label?: string;
}

/** Single choice with chips (kept for longer labels). */
export function ChipGroup<T extends string>({ options, value, onChange, label }: ChipGroupProps<T>) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">
      {options.map((o) => (
        <Chip key={o.id} selected={value === o.id} onClick={() => onChange(o.id)} role="radio" aria-checked={value === o.id}>
          {o.label}
        </Chip>
      ))}
    </div>
  );
}

/** Segmented control for short single-choice options. */
export function Segmented<T extends string>({ options, value, onChange, label, className }: ChipGroupProps<T> & { className?: string }) {
  return (
    <div role="radiogroup" aria-label={label} className={cn("inline-flex max-w-full flex-wrap gap-1 rounded-[14px] bg-muted p-1", className)}>
      {options.map((o) => {
        const on = value === o.id;
        return (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(o.id)}
            className={cn(
              "min-h-11 flex-1 whitespace-nowrap rounded-[10px] px-3 text-sm font-medium transition-all duration-200 md:min-h-9",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              on ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

const TONES = {
  muted: "bg-muted text-muted-foreground",
  primary: "bg-primary/15 text-primary-ink",
  warning: "bg-warning/15 text-warning-ink",
  success: "bg-success/15 text-success-ink",
  destructive: "bg-destructive/15 text-destructive-ink",
} as const;
export type Tone = keyof typeof TONES;

export function Tag({ tone, children, className }: { tone: Tone; children: ReactNode; className?: string }) {
  return <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold", TONES[tone], className)}>{children}</span>;
}

export function Dot({ on }: { on: boolean }) {
  return <span aria-hidden className={cn("inline-block size-2.5 shrink-0 rounded-full", on ? "bg-success shadow-[0_0_0_4px] shadow-success/25" : "bg-tertiary")} />;
}

const GRADS = { blue: "bg-g-blue", orange: "bg-g-orange", green: "bg-g-green", purple: "bg-g-purple" } as const;
export type IconTone = keyof typeof GRADS;

/** 38px gradient tile for highlight icons. */
export function IconTile({ tone = "blue", children, className }: { tone?: IconTone; children: ReactNode; className?: string }) {
  return (
    <span aria-hidden className={cn("flex size-[38px] shrink-0 items-center justify-center rounded-xl text-primary-foreground shadow-sm [&_svg]:size-5", GRADS[tone], className)}>
      {children}
    </span>
  );
}

/** Page title (30px) + subtitle (14px). */
export function PageHeader({ titulo, subtitulo, acao }: { titulo: string; subtitulo?: ReactNode; acao?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-[30px] font-bold leading-tight tracking-[-0.02em]">{titulo}</h1>
        {subtitulo && <p className="mt-1 text-sm text-muted-foreground">{subtitulo}</p>}
      </div>
      {acao}
    </div>
  );
}

/** Empty state: big gradient icon + title + line + action. */
export function EmptyState({ icon, titulo, texto, acao, tone = "blue" }: { icon: ReactNode; titulo: string; texto: ReactNode; acao?: ReactNode; tone?: IconTone }) {
  return (
    <div className="rounded-2xl border bg-card p-10 text-center">
      <IconTile tone={tone} className="mx-auto size-14 rounded-2xl [&_svg]:size-7">{icon}</IconTile>
      <p className="mt-4 text-lg font-semibold">{titulo}</p>
      <p className="mt-1 text-sm text-muted-foreground">{texto}</p>
      {acao && <div className="mt-5 flex justify-center">{acao}</div>}
    </div>
  );
}
