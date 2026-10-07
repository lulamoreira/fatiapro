import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { formatDuracao, formatGramas, roteiroLabel } from "@/lib/fatia";
import type { Erros, PrecoCampos } from "./form";

const CAMPOS: { k: keyof PrecoCampos; label: string; hint?: string }[] = [
  { k: "precoRolo", label: "Preço do rolo (R$)" },
  { k: "pesoRolo", label: "Peso do rolo (kg)" },
  { k: "consumoW", label: "Consumo da impressora (W)", hint: "Se não souber deixe vazio" },
  { k: "kwh", label: "Preço do kWh (R$)" },
  { k: "minAcabamento", label: "Minutos de acabamento/embalagem" },
  { k: "rsHora", label: "R$ por hora de trabalho" },
  { k: "quantidade", label: "Quantidade" },
  { k: "taxaFalha", label: "Taxa de falha (%)" },
];

export function PrecoFields({ v, onChange, erros }: { v: PrecoCampos; onChange: (p: PrecoCampos) => void; erros: Erros }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {CAMPOS.map((c) => (
          <div key={c.k} className="space-y-1.5">
            <Label htmlFor={`p-${c.k}`}>{c.label}</Label>
            <Input id={`p-${c.k}`} inputMode="decimal" value={String(v[c.k] ?? "")} onChange={(e) => onChange({ ...v, [c.k]: e.target.value })} aria-invalid={!!erros[c.k]} />
            {c.hint && <p className="text-xs text-muted-foreground">{c.hint}</p>}
            {erros[c.k] && <p className="text-xs text-destructive">{erros[c.k]}</p>}
          </div>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <PuxarDoHistorico onPick={(g, s) => onChange({ ...v, gramas: g, segundos: s })} />
        {(v.gramas != null || v.segundos != null) && (
          <span className="text-sm text-muted-foreground tabular">Usando {formatGramas(v.gramas)} e {formatDuracao(v.segundos)}</span>
        )}
      </div>
    </div>
  );
}

function PuxarDoHistorico({ onPick }: { onPick: (g: number | null, s: number | null) => void }) {
  const [open, setOpen] = useState(false);
  const { data = [], isLoading } = useQuery({
    queryKey: ["historico_concluidos"],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("jobs")
        .select("id, nome_peca, roteiro, resultado, criado_em", { count: "exact" })
        .eq("estado", "concluido")
        .order("criado_em", { ascending: false })
        .order("id", { ascending: false })
        .range(0, 24);
      if (error) throw error;
      return data;
    },
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button type="button" variant="outline" size="sm">Puxar gramas e tempo de uma análise do histórico</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Escolha uma análise concluída</DialogTitle></DialogHeader>
        {isLoading ? <p className="text-sm text-muted-foreground">Carregando…</p> : data.length === 0 ? <p className="text-sm text-muted-foreground">Nenhuma análise concluída ainda.</p> : (
          <ul className="max-h-80 space-y-1 overflow-y-auto">
            {data.map((j) => {
              const f = (j.resultado as { final?: { gramas?: number; segundos?: number } } | null)?.final;
              return (
                <li key={j.id}>
                  <button type="button" className="w-full rounded-xl p-3 text-left hover:bg-accent" onClick={() => { onPick(f?.gramas ?? null, f?.segundos ?? null); setOpen(false); }}>
                    <p className="font-medium">{j.nome_peca ?? "Peça aberta no fatiador"}</p>
                    <p className="text-xs text-muted-foreground">{roteiroLabel(j.roteiro)} · {formatGramas(f?.gramas)} · {formatDuracao(f?.segundos)}</p>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}
