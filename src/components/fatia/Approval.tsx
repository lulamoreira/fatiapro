import { useMemo, useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tag, type Tone } from "@/components/fatia/Chip";
import { formatDuracao, formatGramas } from "@/lib/fatia";
import { cn } from "@/lib/utils";

export interface PropostaItem {
  id: string;
  titulo: string;
  segundos_delta: number;
  gramas: number;
  impacto: "nenhum" | "pequeno" | "visivel" | null;
  motivo?: string;
  pre_marcado: boolean;
  grupo_exclusivo: string | null;
  rejeitado_motivo: string | null;
}
export interface Proposta {
  partida: { segundos: number; gramas: number };
  itens: PropostaItem[];
  observacao?: string;
}

const IMPACTO: Record<string, { label: string; tone: Tone }> = {
  nenhum: { label: "Nenhum", tone: "success" },
  pequeno: { label: "Pequeno", tone: "warning" },
  visivel: { label: "Visível", tone: "destructive" },
};

export interface ApprovalProps {
  proposta: Proposta;
  disabled: boolean;
  onAprovar: (ids: string[]) => void;
  onPedirOutra: (texto: string) => void;
  onCancelar: () => void;
}

export function Approval({ proposta, disabled, onAprovar, onPedirOutra, onCancelar }: ApprovalProps) {
  const itens = proposta.itens ?? [];
  const [marcados, setMarcados] = useState<Set<string>>(
    () => new Set(itens.filter((i) => i.pre_marcado && !i.rejeitado_motivo).map((i) => i.id)),
  );
  const [pedindo, setPedindo] = useState(false);
  const [texto, setTexto] = useState("");

  function toggle(item: PropostaItem, on: boolean) {
    setMarcados((prev) => {
      const next = new Set(prev);
      if (on) {
        if (item.grupo_exclusivo) for (const o of itens) if (o.grupo_exclusivo === item.grupo_exclusivo) next.delete(o.id);
        next.add(item.id);
      } else next.delete(item.id);
      return next;
    });
  }

  // Derived values — no effect needed.
  const { seg, gr } = useMemo(() => {
    let s = proposta.partida?.segundos ?? 0;
    let g = proposta.partida?.gramas ?? 0;
    for (const i of itens) if (marcados.has(i.id)) { s += i.segundos_delta ?? 0; g += i.gramas ?? 0; }
    return { seg: s, gr: g };
  }, [itens, marcados, proposta.partida]);
  const economia = (proposta.partida?.segundos ?? 0) - seg;

  return (
    <section className="space-y-5" aria-label="Aprovação">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Card t="Ponto de partida" a={formatDuracao(proposta.partida?.segundos)} b={formatGramas(proposta.partida?.gramas)} />
        <Card t="Com o que você marcou" a={formatDuracao(seg)} b={formatGramas(gr)} highlight />
        <Card t="Economia estimada" a={formatDuracao(economia)} b={formatGramas((proposta.partida?.gramas ?? 0) - gr)} />
      </div>

      <ul className="divide-y rounded-2xl border bg-card">
        {itens.map((i) => {
          const imp = i.impacto ? IMPACTO[i.impacto] : null;
          return (
            <li key={i.id} className="flex items-start gap-3 p-4">
              <Checkbox
                id={`it-${i.id}`}
                checked={marcados.has(i.id)}
                disabled={disabled}
                onCheckedChange={(v) => toggle(i, v === true)}
                className="mt-0.5"
              />
              <label htmlFor={`it-${i.id}`} className="min-w-0 flex-1 cursor-pointer">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="font-medium">{i.titulo}</span>
                  <span className={cn("text-sm font-semibold tabular", i.segundos_delta < 0 ? "text-success" : i.segundos_delta > 0 ? "text-destructive" : "text-muted-foreground")}>
                    {i.segundos_delta > 0 ? "+" : ""}{formatDuracao(i.segundos_delta)}
                  </span>
                  <span className="text-sm text-muted-foreground tabular">{formatGramas(i.gramas)}</span>
                  {imp && <Tag tone={imp.tone}>{imp.label}</Tag>}
                </div>
                {i.motivo && <p className="mt-1 text-sm text-muted-foreground">{i.motivo}</p>}
                {i.rejeitado_motivo && <p className="mt-1 text-xs text-destructive">{i.rejeitado_motivo}</p>}
              </label>
            </li>
          );
        })}
      </ul>
      <p className="text-xs text-muted-foreground">Cada linha foi testada sozinha no fatiador. Ao aplicar, tudo é fatiado de novo junto e mostramos o número real.</p>

      {proposta.observacao && (
        <div className="rounded-2xl bg-accent p-5">
          <h3 className="text-sm font-semibold text-accent-foreground">Por que recomendo assim</h3>
          <p className="mt-1 whitespace-pre-line text-sm">{proposta.observacao}</p>
        </div>
      )}

      {pedindo && (
        <div className="space-y-2">
          <Textarea value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="O que você quer diferente?" maxLength={1000} aria-label="Pedido de outra opção" />
          <div className="flex gap-2">
            <Button size="sm" disabled={!texto.trim() || disabled} onClick={() => { onPedirOutra(texto.trim()); setPedindo(false); setTexto(""); }}>Enviar pedido</Button>
            <Button size="sm" variant="ghost" onClick={() => setPedindo(false)}>Fechar</Button>
          </div>
        </div>
      )}

      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="ghost" disabled={disabled} onClick={onCancelar}>Cancelar</Button>
        <Button variant="outline" disabled={disabled} onClick={() => setPedindo(true)}>Pedir outra opção</Button>
        <Button size="lg" disabled={disabled || marcados.size === 0} onClick={() => onAprovar([...marcados])}>
          Ok, aplicar {marcados.size} {marcados.size === 1 ? "mudança" : "mudanças"}
        </Button>
      </div>
    </section>
  );
}

function Card({ t, a, b, highlight }: { t: string; a: string; b: string; highlight?: boolean }) {
  return (
    <div className={cn("rounded-2xl border p-4", highlight ? "border-primary bg-accent" : "bg-card")}>
      <p className="text-xs font-medium text-muted-foreground">{t}</p>
      <p className="mt-1 font-display text-2xl font-bold tabular">{a}</p>
      <p className="text-sm text-muted-foreground tabular">{b}</p>
    </div>
  );
}
