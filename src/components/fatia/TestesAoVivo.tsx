import type { ComponentProps } from "react";
import { AlertTriangle, Check, ChevronDown, Loader2 } from "lucide-react";
import { Tag } from "@/components/fatia/Chip";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { formatDuracao, formatGramas } from "@/lib/fatia";
import type { GrupoTestes, TesteAoVivo } from "@/lib/progresso-analise";
import { cn } from "@/lib/utils";

export interface TestesAoVivoProps extends ComponentProps<"section"> {
  grupos: GrupoTestes[];
}

const ESTADOS_TESTE = {
  fatiando: { texto: "Fatiando", Icone: Loader2, tone: "muted" },
  pronto: { texto: "Pronto", Icone: Check, tone: "success" },
  falhou: { texto: "Falhou", Icone: AlertTriangle, tone: "warning" },
  escolhido: { texto: "Escolhido", Icone: Check, tone: "primary" },
} as const;

function Diferenca({ valor, referencia, suporte = false }: { valor: number | undefined; referencia: number | undefined; suporte?: boolean }) {
  if (valor == null || referencia == null) return null;
  const delta = valor - referencia;
  return (
    <span className={cn("text-xs tabular", delta < 0 ? "text-success-ink" : "text-muted-foreground")}>
      {suporte ? "Suporte: " : "Tempo: "}{delta < 0 ? "−" : delta > 0 ? "+" : ""}
      {suporte ? formatGramas(Math.abs(delta)) : formatDuracao(Math.abs(delta))}
    </span>
  );
}

function CartaoTeste({ teste, atual }: { teste: TesteAoVivo; atual: TesteAoVivo | undefined }) {
  const { texto, Icone, tone } = ESTADOS_TESTE[teste.estado];
  const titulo = teste.titulo ?? teste.id;
  return (
    <article aria-label={titulo} className={cn("min-w-0 overflow-hidden rounded-2xl border bg-card", teste.estado === "escolhido" ? "border-primary" : "border-border")}>
      {teste.imagem && <img src={teste.imagem} alt={titulo} className="aspect-video w-full object-contain" />}
      <div className="space-y-3 p-4">
        <h4 className="break-words text-sm font-semibold">{titulo}</h4>
        <div className="flex flex-wrap gap-2">
          <Tag tone={tone} className="gap-1">
            <Icone aria-hidden className={cn("size-3.5 shrink-0", teste.estado === "fatiando" && "motion-safe:animate-spin")} />{texto}
          </Tag>
          {teste.atual && <Tag tone="muted">Como a peça veio</Tag>}
        </div>
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-sm text-muted-foreground tabular">
          {teste.segundos != null && <span>{formatDuracao(teste.segundos)}</span>}
          {teste.gramas != null && <span>{formatGramas(teste.gramas)}</span>}
          {teste.suporte_g != null && <span>suporte {formatGramas(teste.suporte_g)}</span>}
        </div>
        {atual && atual.id !== teste.id && (
          <div className="flex flex-wrap gap-x-3 gap-y-1" aria-label="Comparação com a peça como veio">
            <Diferenca valor={teste.segundos} referencia={atual.segundos} />
            <Diferenca valor={teste.suporte_g} referencia={atual.suporte_g} suporte />
          </div>
        )}
        {teste.estado === "falhou" && teste.erro && <p className="line-clamp-2 break-words text-xs text-muted-foreground" title={teste.erro}>{teste.erro}</p>}
      </div>
    </article>
  );
}

export function TestesAoVivo({ grupos, className, ...props }: TestesAoVivoProps) {
  if (!grupos.some((grupo) => grupo.testes.length > 0)) return null;
  return (
    <section aria-label="Testes da análise" className={cn("space-y-5", className)} {...props}>
      {grupos.filter((grupo) => grupo.testes.length > 0).map((grupo) => (
        <div key={grupo.grupo} className="space-y-2">
          <h3 className="text-sm font-semibold text-muted-foreground">{grupo.grupo}</h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {grupo.testes.map((teste) => <CartaoTeste key={teste.id} teste={teste} atual={grupo.testes.find((t) => t.atual)} />)}
          </div>
        </div>
      ))}
    </section>
  );
}

export interface BlocoTestesAoVivoProps extends TestesAoVivoProps {
  emAndamento: boolean;
}

export function BlocoTestesAoVivo({ grupos, emAndamento, ...props }: BlocoTestesAoVivoProps) {
  const total = grupos.reduce((soma, grupo) => soma + grupo.testes.length, 0);
  if (!total) return null;
  return (
    <Collapsible key={String(emAndamento)} defaultOpen={emAndamento} className="space-y-3">
      <CollapsibleTrigger asChild>
        <Button variant="ghost" className="group w-full justify-between">
          Testes feitos ({total})<ChevronDown aria-hidden className="size-4 group-data-[state=open]:rotate-180 motion-safe:transition-transform" />
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent><TestesAoVivo grupos={grupos} {...props} /></CollapsibleContent>
    </Collapsible>
  );
}