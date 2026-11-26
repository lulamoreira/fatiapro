import { useState } from "react";
import { Merge } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { CorSlot } from "@/lib/colorir/paleta";
export interface PaletaProps {
  cores: CorSlot[];
  quantidade: number;
  ativo: number;
  usadas: number[];
  onAtivo: (slot: number) => void;
  onCor: (index: number, cor: CorSlot) => void;
  onJuntar: (a: number, b: number) => void;
  disabled: boolean;
}
export function Paleta({
  cores,
  quantidade,
  ativo,
  usadas,
  onAtivo,
  onCor,
  onJuntar,
  disabled,
}: PaletaProps) {
  const [juntar, setJuntar] = useState(false),
    [a, setA] = useState(1),
    [b, setB] = useState(2);
  return (
    <section className="space-y-3 border-t border-border pt-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Filamentos</h2>
        <span className="text-xs tabular-nums text-muted-foreground">
          Cores usadas: {usadas.length} de {quantidade}
        </span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {cores.slice(0, quantidade).map((c, i) => (
          <Button
            key={i + 1}
            variant="ghost"
            size="icon"
            aria-label={`Filamento ${i + 1}: ${c.nome}`}
            aria-pressed={ativo === i + 1}
            title={`${i + 1} · ${c.nome}`}
            className={cn("border border-border", ativo === i + 1 && "ring-2 ring-ring")}
            onClick={() => onAtivo(i + 1)}
          >
            <svg width="24" height="24" aria-hidden>
              <circle cx="12" cy="12" r="11" fill={c.cor} />
            </svg>
          </Button>
        ))}
      </div>
      {cores[ativo - 1] && (
        <div className="space-y-2">
          <Label htmlFor="nome-cor">
            Filamento {ativo}
            {ativo === 1 ? " · Cor base" : ""}
          </Label>
          <Input
            id="nome-cor"
            maxLength={40}
            value={cores[ativo - 1]?.nome ?? ""}
            onChange={(e) =>
              onCor(ativo - 1, { nome: e.target.value, cor: cores[ativo - 1]?.cor ?? "#FFFFFF" })
            }
          />
          <div className="flex gap-2">
            <Input
              type="color"
              aria-label="Cor do filamento"
              className="h-10 w-14 p-1"
              value={cores[ativo - 1]?.cor}
              onChange={(e) =>
                onCor(ativo - 1, { nome: cores[ativo - 1]?.nome ?? "", cor: e.target.value })
              }
            />
            <HexCor
              key={`${ativo}-${cores[ativo - 1]?.cor}`}
              cor={cores[ativo - 1]?.cor ?? "#FFFFFF"}
              onChange={(c) => onCor(ativo - 1, { nome: cores[ativo - 1]?.nome ?? "", cor: c })}
            />
          </div>
        </div>
      )}
      <Button variant="outline" size="sm" disabled={disabled} onClick={() => setJuntar(!juntar)}>
        <Merge />
        Juntar cores
      </Button>
      {juntar && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Label>De</Label>
            <select
              aria-label="Slot B"
              className="min-w-0 flex-1 rounded-xl border border-border bg-background p-2 text-sm"
              value={b}
              onChange={(e) => setB(Number(e.target.value))}
            >
              {cores.slice(0, quantidade).map((c, i) => (
                <option key={i + 1} value={i + 1}>
                  {i + 1} · {c.nome}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <Label>Para</Label>
            <select
              aria-label="Slot A"
              className="min-w-0 flex-1 rounded-xl border border-border bg-background p-2 text-sm"
              value={a}
              onChange={(e) => setA(Number(e.target.value))}
            >
              {cores.slice(0, quantidade).map((c, i) => (
                <option key={i + 1} value={i + 1}>
                  {i + 1} · {c.nome}
                </option>
              ))}
            </select>
          </div>
          <Button
            variant="secondary"
            size="sm"
            disabled={disabled || a === b}
            onClick={() => {
              onJuntar(a, b);
              setJuntar(false);
            }}
          >
            Unir filamentos
          </Button>
        </div>
      )}
    </section>
  );
}
function HexCor({ cor, onChange }: { cor: string; onChange: (c: string) => void }) {
  const [texto, setTexto] = useState(cor);
  return (
    <Input
      aria-label="Código hexadecimal"
      maxLength={7}
      value={texto}
      onChange={(e) => {
        setTexto(e.target.value);
        if (/^#[0-9a-f]{6}$/i.test(e.target.value)) onChange(e.target.value.toUpperCase());
      }}
      onBlur={() => setTexto(cor)}
    />
  );
}
