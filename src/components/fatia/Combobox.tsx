import { useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils";

export interface ComboboxProps {
  options: readonly string[];
  value: string | null;
  onChange: (v: string) => void;
  placeholder: string;
  label: string;
  vazio?: string;
  disabled?: boolean;
}

/** Searchable single-choice field for long lists (printers, filament brands/lines). */
export function Combobox({ options, value, onChange, placeholder, label, vazio = "Nada encontrado.", disabled }: ComboboxProps) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          role="combobox"
          aria-expanded={open}
          aria-label={label}
          disabled={disabled}
          className="flex min-h-11 w-full items-center justify-between gap-2 rounded-[14px] border border-input bg-card px-3 text-left text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
        >
          <span className={cn("truncate", !value && "text-muted-foreground")}>{value ?? placeholder}</span>
          <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] min-w-64 p-1" align="start">
        <Command className="bg-transparent">
          <CommandInput placeholder="Buscar…" />
          <CommandList>
            <CommandEmpty>{vazio}</CommandEmpty>
            <CommandGroup>
              {options.map((o) => (
                <CommandItem key={o} value={o} onSelect={() => { onChange(o); setOpen(false); }} className="min-h-10 rounded-[10px]">
                  <Check className={cn("size-4", value === o ? "opacity-100" : "opacity-0")} aria-hidden />
                  {o}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
