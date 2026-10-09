import { useState } from "react";
import { nomePecaExibicao } from "@/lib/nome-peca";
import { Link } from "@tanstack/react-router";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { adminFeedback } from "@/lib/admin-cobranca.functions";
import type { Periodo } from "@/lib/admin-cobranca";
import { roteiroLabel } from "@/lib/fatia";
import { Segmented } from "@/components/fatia/Chip";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

const PERIODOS: { id: Periodo; label: string }[] = [{ id: "7d", label: "7 dias" }, { id: "30d", label: "30 dias" }, { id: "tudo", label: "Tudo" }];
const PROB: Record<string, string> = { descolou: "Descolou da mesa", suporte: "Falha no suporte", acabamento: "Acabamento ruim", fraca: "Peça fraca", outro: "Outro" };
const TEMPO: Record<string, string> = { nada: "Nada", ate_15: "Até 15 min", "15_60": "15–60 min", mais_60: "Mais de 1 hora" };
const RESP: Record<string, string> = { sim: "fez sentido", em_parte: "em parte", nao: "não fez sentido", sim_boa: "imprimiu, ficou boa", sim_problema: "imprimiu, deu problema", ainda_nao: "ainda não imprimiu", nao_vou: "não vai imprimir" };
const pct = (v: number | null) => (v == null ? "—" : `${Math.round(v)}%`);

export function AdminFeedback() {
  const fn = useServerFn(adminFeedback);
  const [periodo, setPeriodo] = useState<Periodo>("30d");
  const [pagina, setPagina] = useState(1);
  const q = useQuery({ queryKey: ["admin", "feedback", periodo, pagina], queryFn: () => fn({ data: { periodo, pagina } }), placeholderData: keepPreviousData });
  const d = q.data;

  return (
    <div className="space-y-5">
      <Segmented label="Período" options={PERIODOS} value={periodo} onChange={(p) => { setPeriodo(p); setPagina(1); }} />
      {q.isError && <p role="alert" className="text-sm text-destructive-ink">{(q.error as Error).message}</p>}
      {!d ? <Skeleton className="h-40" /> : (
        <>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <Card titulo="Respostas" valor={String(d.resumo.total)} />
            <Card titulo="Fez sentido" valor={pct(d.resumo.sentido.pct)} extra={`Sim ${d.resumo.sentido.sim} · Em parte ${d.resumo.sentido.em_parte} · Não ${d.resumo.sentido.nao}`} />
            <Card titulo="Impressões que deram certo" valor={pct(d.resumo.impressao.pct)} extra={`${d.resumo.impressao.boa} boas · ${d.resumo.impressao.problema} com problema`} />
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <Barras titulo="Problemas mais comuns" dados={d.resumo.problemas} rotulos={PROB} ordenar />
            <Barras titulo="Tempo poupado" dados={d.resumo.tempo} rotulos={TEMPO} />
          </div>
          <ul className="overflow-hidden rounded-2xl bg-card shadow-sm">
            {d.linhas.length === 0 ? <li className="p-6 text-center text-sm text-muted-foreground">Nenhuma resposta no período.</li> : d.linhas.map((l) => (
              <li key={l.id} className="space-y-1 border-b px-4 py-3 text-sm last:border-b-0">
                <p className="flex flex-wrap gap-x-2 text-xs text-muted-foreground"><span>{new Date(l.criado_em).toLocaleDateString("pt-BR")}</span><span>· {l.email}</span><span>· {roteiroLabel(l.jobs?.roteiro)}</span></p>
                <Link to="/app/analise/$id" params={{ id: l.job_id }} className="font-semibold text-primary-ink hover:underline">{nomePecaExibicao(l.jobs?.nome_peca)}</Link>
                <p className="text-xs">{RESP[l.fez_sentido]} · {RESP[l.imprimiu]}{l.problemas.length ? ` (${l.problemas.map((p) => PROB[p] ?? p).join(", ")})` : ""} · poupou {l.tempo_poupado ? TEMPO[l.tempo_poupado] : "—"}</p>
                {l.comentario && <p className="rounded-lg bg-muted p-2 text-sm">{l.comentario}</p>}
              </li>
            ))}
          </ul>
          {d.total > d.por_pagina && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Página {pagina} de {Math.ceil(d.total / d.por_pagina)}</span>
              <div className="flex gap-2">
                <Button size="sm" variant="secondary" disabled={pagina <= 1} onClick={() => setPagina((p) => p - 1)}>Anterior</Button>
                <Button size="sm" variant="secondary" disabled={pagina * d.por_pagina >= d.total} onClick={() => setPagina((p) => p + 1)}>Próxima</Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export function Card({ titulo, valor, extra }: { titulo: string; valor: string; extra?: string }) {
  return (
    <div className="rounded-2xl bg-card p-4 shadow-sm">
      <p className="text-xs font-medium text-muted-foreground">{titulo}</p>
      <p className="mt-1 text-[26px] font-bold leading-tight tabular">{valor}</p>
      {extra && <p className="mt-1 text-xs text-muted-foreground">{extra}</p>}
    </div>
  );
}

function Barras({ titulo, dados, rotulos, ordenar }: { titulo: string; dados: Record<string, number>; rotulos: Record<string, string>; ordenar?: boolean }) {
  const itens = Object.entries(dados);
  if (ordenar) itens.sort((a, b) => b[1] - a[1]);
  const max = Math.max(1, ...itens.map(([, v]) => v));
  return (
    <div className="space-y-2 rounded-2xl bg-card p-4 shadow-sm">
      <p className="text-xs font-medium text-muted-foreground">{titulo}</p>
      {itens.map(([k, v]) => (
        <div key={k} className="space-y-0.5 text-xs">
          <div className="flex justify-between"><span>{rotulos[k] ?? k}</span><span className="tabular">{v}</span></div>
          <div className="h-2 rounded-full bg-muted"><div className="h-2 rounded-full bg-primary" style={{ width: `${(v / max) * 100}%` }} /></div>
        </div>
      ))}
    </div>
  );
}
