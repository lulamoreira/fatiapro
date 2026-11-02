import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { KWH_MEDIO_UF } from "@/lib/energia";

export interface EstadoSelectProps {
  id: string;
  label: string;
  value: string | null | undefined;
  onChange: (uf: string | null) => void;
  disabled?: boolean;
}

export function EstadoSelect({ id, label, value, onChange, disabled }: EstadoSelectProps) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Select value={value || "sem-estado"} onValueChange={(v) => onChange(v === "sem-estado" ? null : v)} disabled={disabled}>
        <SelectTrigger id={id}><SelectValue placeholder="Não informado" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="sem-estado">Não informado</SelectItem>
          {Object.keys(KWH_MEDIO_UF).map((uf) => <SelectItem key={uf} value={uf}>{uf}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );
}