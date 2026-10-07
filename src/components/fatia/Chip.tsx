import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface ChipProps extends Omit<ComponentProps<"button">, "children"> {
  selected?: boolean;
  badge?: ReactNode;
  children: ReactNode;
}

/** Clickable pill used for every option in the app. */
export function Chip({ selected, badge, className, children, ...props }: ChipProps) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      className={cn(
        "inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-all",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        "disabled:cursor-not-allowed disabled:opacity-50",
        selected
          ? "border-primary bg-primary text-primary-foreground shadow-sm"
          : "border-border bg-card text-foreground hover:border-primary/50 hover:bg-accent",
        className,
      )}
      {...props}
    >
      {badge != null && (
        <span className={cn("rounded-full px-1.5 text-xs font-bold", selected ? "bg-primary-foreground/20" : "bg-muted")}>{badge}</span>
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

const TONES = {
  muted: "bg-muted text-muted-foreground",
  primary: "bg-primary/15 text-primary",
  warning: "bg-warning/25 text-warning-foreground dark:text-warning",
  success: "bg-success/15 text-success",
  destructive: "bg-destructive/15 text-destructive",
} as const;
export type Tone = keyof typeof TONES;

export function Tag({ tone, children, className }: { tone: Tone; children: ReactNode; className?: string }) {
  return <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold", TONES[tone], className)}>{children}</span>;
}

export function Dot({ on }: { on: boolean }) {
  return <span aria-hidden className={cn("inline-block size-2.5 rounded-full", on ? "bg-success shadow-[0_0_0_3px] shadow-success/20" : "bg-muted-foreground/40")} />;
}
