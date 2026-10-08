import { useState } from "react";
import { Check, ChevronsUpDown, Plus } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils";

export interface ComboboxGrupo {
  titulo?: string;
  options: readonly string[];
}

export interface ComboboxProps {
  /** Flat list (single unnamed group). Ignored when `groups` is set. */
  options?: readonly string[];
  groups?: readonly ComboboxGrupo[];
  value: string | null;
  onChange: (v: string) => void;
  placeholder: string;
  label: string;
  vazio?: string;
  disabled?: boolean;
  /** When set, typed text not in the list is offered as "Usar '<texto>' como …". */
  criarComo?: string;
}

/** Searchable single-choice field for long lists (printers, filament brands/lines). */
export function Combobox({ options = [], groups, value, onChange, placeholder, label, vazio = "Nada encontrado.", disabled, criarComo }: ComboboxProps) {
  const [open, setOpen] = useState(false);
  const [busca, setBusca] = useState("");
  const grupos = groups ?? [{ options }];
  const texto = busca.trim().slice(0, 60);
  const existe = grupos.some((g) => g.options.some((o) => o.toLowerCase() === texto.toLowerCase()));
  const escolher = (v: string) => { onChange(v); setOpen(false); setBusca(""); };

  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (!o) setBusca(""); }}>
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
          <CommandInput placeholder="Buscar…" value={busca} onValueChange={setBusca} />
          <CommandList>
            {!(criarComo && texto) && <CommandEmpty>{vazio}</CommandEmpty>}
            {grupos.map((g) =>
              g.options.length ? (
                <CommandGroup key={g.titulo ?? "_"} heading={g.titulo}>
                  {g.options.map((o) => (
                    <CommandItem key={o} value={o} onSelect={() => escolher(o)} className="min-h-10 rounded-[10px]">
                      <Check className={cn("size-4", value === o ? "opacity-100" : "opacity-0")} aria-hidden />
                      {o}
                    </CommandItem>
                  ))}
                </CommandGroup>
              ) : null,
            )}
            {criarComo && texto && !existe && (
              <CommandGroup forceMount>
                <CommandItem forceMount value={`__criar__${texto}`} onSelect={() => escolher(texto)} className="min-h-10 rounded-[10px]">
                  <Plus className="size-4" aria-hidden />
                  Usar '{texto}' como {criarComo}
                </CommandItem>
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
