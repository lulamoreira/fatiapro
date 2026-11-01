import type { ComponentProps } from "react";
import { Chip, Segmented } from "@/components/fatia/Chip";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { tipoDoPerfil, type Cor3mf } from "@/lib/cores-3mf";
import type { FormState } from "@/components/fatia/form";
import { cn } from "@/lib/utils";

const TIPOS = ["PLA", "PLA Silk", "PETG", "TPU", "ABS/ASA", "Outro"];
export interface FilamentoMistoProps extends Omit<ComponentProps<"div">, "onChange"> {
  form: FormState;
  cores: Cor3mf[] | null;
  onChange: (campos: Pick<FormState, "filMisto" | "filMistoTipos" | "filMistoCores">) => void;
}

export function FilamentoMisto({ form: f, cores, onChange, className, ...props }: FilamentoMistoProps) {
  const porCor = cores && cores.length >= 2 ? cores : null;
  return (
    <div className={cn("min-w-0 space-y-3", className)} {...props}>
      <Label>Esta peça usa mais de um tipo de filamento?</Label>
      <div><Segmented label="Esta peça usa mais de um tipo de filamento?" options={[{ id: "sim", label: "Sim" }, { id: "nao", label: "Não" }]} value={f.filMisto === null ? null : f.filMisto ? "sim" : "nao"}
        onChange={(v) => onChange(v === "nao" ? { filMisto: false, filMistoTipos: [], filMistoCores: [] } : { filMisto: true, filMistoTipos: f.filMistoTipos, filMistoCores: porCor ? porCor.map((c) => ({ slot: c.slot, tipo: f.filMistoCores.find((x) => x.slot === c.slot)?.tipo ?? tipoDoPerfil(c.perfil) })) : [] })} /></div>
      {f.filMisto === true && <>
        {porCor ? <div className="space-y-2">{porCor.map((c) => (
          <div key={c.slot} className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] items-center gap-3">
            <span className="flex items-center gap-2 text-sm">
              <svg aria-hidden className="size-5 shrink-0 rounded-full border bg-muted" viewBox="0 0 20 20"><circle cx="10" cy="10" r="10" fill={/^#[\da-f]{6}([\da-f]{2})?$/i.test(c.cor) ? c.cor : "currentColor"} /></svg>
              Cor {c.slot}
            </span>
            <Select value={f.filMistoCores.find((x) => x.slot === c.slot)?.tipo ?? tipoDoPerfil(c.perfil)} onValueChange={(tipo) => onChange({ filMisto: true, filMistoTipos: f.filMistoTipos, filMistoCores: porCor.map((x) => ({ slot: x.slot, tipo: x.slot === c.slot ? tipo : f.filMistoCores.find((v) => v.slot === x.slot)?.tipo ?? tipoDoPerfil(x.perfil) })) })}>
              <SelectTrigger aria-label={`Tipo da Cor ${c.slot}`} className="min-h-11 min-w-0"><SelectValue /></SelectTrigger>
              <SelectContent>{TIPOS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        ))}</div> : <div className="space-y-2">
          <p className="text-sm font-medium">Quais outros tipos?</p>
          <div className="flex flex-wrap gap-2">{TIPOS.filter((t) => t !== "PLA").map((t) => <Chip key={t} selected={f.filMistoTipos.includes(t)} onClick={() => onChange({ filMisto: true, filMistoCores: [], filMistoTipos: f.filMistoTipos.includes(t) ? f.filMistoTipos.filter((x) => x !== t) : [...f.filMistoTipos, t] })}>{t}</Chip>)}</div>
        </div>}
        <p className="text-xs text-muted-foreground">O PLA Silk recebe ajustes automáticos para soltar menos fios.</p>
      </>}
    </div>
  );
}