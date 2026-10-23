/**
 * Aprovação do roteiro "Produção em lote": escolha ÚNICA da posição da peça.
 * Diferente do Approval (várias mudanças), aqui cada item é uma posição testada
 * pela ponte e o usuário escolhe uma só — o .3mf sai com as cópias arrumadas.
 */
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tag } from "@/components/fatia/Chip";
import { IMPACTO, type ApprovalProps, type PropostaItem } from "@/components/fatia/Approval";
import { formatDuracao, formatGramas } from "@/lib/fatia";
import { cn } from "@/lib/utils";

export interface ProducaoInfo {
  quantidade: number | null;
  mesa_mm: [number, number];
}

export interface ItemProducao {
  por_placa: number;
  segundos_placa: number;
  gramas_placa: number;
  segundos_por_peca: number;
  pecas_por_hora: number;
  placas: number;
  copias: number;
  segundos_total: number;
  suporte: boolean;
  altura_mm: number;
  balanco_pct: number;
  medido: boolean;
}

export interface PropostaItemProducao extends PropostaItem {
  producao?: ItemProducao;
}

export interface PropostaProducao {
  partida: { segundos: number; gramas: number };
  itens: PropostaItemProducao[];
  observacao?: string;
  producao?: ProducaoInfo;
}

export function ApprovalProducao({ proposta, disabled, onAprovar, onPedirOutra, onCancelar }: ApprovalProps) {
  const p = proposta as PropostaProducao;
  const itens = p.itens ?? [];
  const [selecionado, setSelecionado] = useState<string | null>(
    () => itens.find((i) => i.pre_marcado && !i.rejeitado_motivo)?.id ?? itens[0]?.id ?? null,
  );
  const [pedindo, setPedindo] = useState(false);
  const [texto, setTexto] = useState("");

  const sel = itens.find((i) => i.id === selecionado) ?? null;
  const quantidade = p.producao?.quantidade ?? null;

  return (
    <section className="space-y-5" aria-label="Aprovação da produção em lote">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Card t="Uma peça sozinha" a={formatDuracao(p.partida?.segundos)} b={formatGramas(p.partida?.gramas)} />
        <Card
          t="Na posição escolhida"
          a={sel?.producao ? formatDuracao(sel.producao.segundos_por_peca) : "—"}
          b={sel ? `${formatGramas(sel.gramas)} por peça` : "—"}
          highlight
        />
        <Card
          t="Peças por placa"
          a={sel?.producao ? String(sel.producao.por_placa) : "—"}
          b={quantidade != null && sel?.producao ? `${sel.producao.copias} peças em ${sel.producao.placas} ${sel.producao.placas === 1 ? "placa" : "placas"} · total ${formatDuracao(sel.producao.segundos_total)}` : "por placa cheia"}
        />
      </div>

      <div role="radiogroup" aria-label="Posição da peça" className="grid grid-cols-1 gap-3">
        {itens.map((i) => {
          const on = i.id === selecionado;
          const imp = i.impacto ? IMPACTO[i.impacto] : null;
          const pr = i.producao;
          return (
            <button
              key={i.id}
              type="button"
              role="radio"
              aria-checked={on}
              disabled={disabled}
              onClick={() => setSelecionado(i.id)}
              className={cn(
                "lift rounded-2xl border-2 p-4 text-left",
                on ? "border-primary bg-primary/8 shadow-aqua" : "border-border bg-card shadow-sm",
              )}
            >
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="font-medium">{i.titulo}</span>
                {imp && <Tag tone={imp.tone}>{imp.label}</Tag>}
                {pr?.suporte && <Tag tone="primary">Com suporte em árvore</Tag>}
                {pr && pr.medido === false && (
                  <Tag tone="muted">
                    <span title="Tempo estimado pela peça sozinha; as melhores posições foram fatiadas com a placa cheia">estimado</span>
                  </Tag>
                )}
              </div>
              {pr && (
                <>
                  <p className="mt-2 font-display text-3xl font-bold tabular">
                    {pr.por_placa} <span className="text-base font-semibold text-muted-foreground">por placa</span>
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground tabular">
                    {formatDuracao(pr.segundos_por_peca)} por peça · {formatGramas(i.gramas)} por peça · placa cheia {formatDuracao(pr.segundos_placa)} e {formatGramas(pr.gramas_placa)}
                  </p>
                  {quantidade != null && (
                    <p className="mt-1 text-sm font-medium tabular">
                      Para {pr.copias} peças: {pr.placas} {pr.placas === 1 ? "placa" : "placas"} · {formatDuracao(pr.segundos_total)} no total
                    </p>
                  )}
                </>
              )}
              {i.motivo && <p className="mt-2 text-sm text-muted-foreground">{i.motivo}</p>}
              {i.rejeitado_motivo && <p className="mt-1 text-xs text-destructive">{i.rejeitado_motivo}</p>}
            </button>
          );
        })}
      </div>
      <p className="text-xs text-muted-foreground">Ao gerar, o fatiador arruma todas as cópias e fatia o arquivo de verdade.</p>

      {p.observacao && (
        <div className="rounded-2xl bg-accent p-5">
          <h3 className="text-sm font-semibold text-accent-foreground">Por que recomendo assim</h3>
          <p className="mt-1 whitespace-pre-line text-sm">{p.observacao}</p>
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
        <Button size="lg" disabled={disabled || !selecionado} onClick={() => selecionado && onAprovar([selecionado])}>
          Gerar arquivo de produção
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
