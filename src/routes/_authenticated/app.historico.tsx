import { useIsAdmin } from "@/hooks/use-is-admin";
import { useFatiadorLabel } from "@/hooks/use-fatiador-label";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { filtroHistorico, lerHistoricoSearch } from "@/lib/inicio";
import { FiltrosAtivos } from "@/components/fatia/FiltrosAtivos";
import { ResumoPedidoLinha } from "@/components/fatia/ResumoPedido";
import { kpisUsuarioQuery } from "@/components/inicio/VisaoUsuario";
import { devicesQuery, historicoQuery, PAGE_SIZE } from "@/lib/queries";
import { ESTADOS, fatiadorLabel, formatDuracao, formatUSD, isConectado, motorLabel, roteiroLabel, type Estado } from "@/lib/fatia";
import { Tag } from "@/components/fatia/Chip";
import { arquivoDoResultado, avisoAcao } from "@/components/fatia/ArquivoCard";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronRight } from "lucide-react";
import { useDevicesLive } from "@/hooks/use-devices-live";
import type { Tables } from "@/integrations/supabase/types";
import { SalvarModeloDialog } from "@/components/fatia/SalvarModeloDialog";
import { SalvarBibliotecaDialog } from "@/components/fatia/SalvarBibliotecaDialog";

export const Route = createFileRoute("/_authenticated/app/historico")({
  validateSearch: lerHistoricoSearch,
  head: () => ({ meta: [{ title: "Histórico — FatiaPro" }, { name: "description", content: "Suas análises de fatiamento e gastos do mês." }] }),
  component: HistoricoPage,
});

type Ponto = { segundos?: number; gramas?: number } | undefined;
function antesDepois(resultado: unknown): string {
  const r = (resultado ?? {}) as { partida?: Ponto; final?: Ponto };
  if (!r.partida && !r.final) return "—";
  return `${formatDuracao(r.partida?.segundos)} → ${formatDuracao(r.final?.segundos)}`;
}
function custo(motor: string, c: unknown): string {
  if (motor === "assinatura") return "uso do plano";
  const usd = (c as { usd?: number } | null)?.usd;
  return typeof usd === "number" ? formatUSD(usd) : "—";
}

function HistoricoPage() {
  const rotuloFat = useFatiadorLabel();
  const search = Route.useSearch();
  const pagina = search.pagina ?? 0;
  const { estado, roteiro, periodo } = search;
  const filtros = filtroHistorico({ estado, roteiro, periodo });
  const navigate = useNavigate();
  const { data: devices = [] } = useQuery(devicesQuery);
  useDevicesLive();
  async function abrirPasta(jobId: string, deviceId: string | null) {
    const { error } = await supabase.from("job_events").insert({ job_id: jobId, tipo: "acao", conteudo: { acao: "abrir_pasta" } });
    if (error) { toast.error("Não foi possível enviar o pedido."); return; }
    const d = devices.find((x) => x.id === deviceId);
    toast.success(avisoAcao(isConectado(d?.ultimo_contato, Date.now())));
  }
  const { data, isLoading } = useQuery({ ...historicoQuery(pagina, filtros), placeholderData: keepPreviousData });
  const { data: k } = useQuery(kpisUsuarioQuery);
  const resumo = k ? { usd: Number(k.api_usd_mes), assinatura: k.assinatura_mes } : undefined;
  const isAdmin = useIsAdmin();
  const totalPaginas = Math.max(1, Math.ceil((data?.total ?? 0) / PAGE_SIZE));

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <h1 className="text-[30px] font-bold tracking-[-0.02em]">Histórico</h1>
      <FiltrosAtivos valores={[estado, roteiro, periodo]} onLimpar={() => navigate({ to: "/app/historico", search: {} })} />
      {isAdmin && <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border bg-card p-5">
          <p className="text-sm text-muted-foreground">Gasto na API este mês</p>
          <p className="mt-1 font-display text-3xl font-bold tabular">{resumo ? formatUSD(resumo.usd) : "…"}</p>
        </div>
        <div className="rounded-2xl border bg-card p-5">
          <p className="text-sm text-muted-foreground">Análises pela assinatura este mês</p>
          <p className="mt-1 font-display text-3xl font-bold tabular">{resumo ? resumo.assinatura : "…"}</p>
        </div>
      </div>}

      {isLoading ? (
        <Skeleton className="h-64 rounded-2xl" />
      ) : !data?.rows.length && (estado || roteiro || periodo) ? (
        <div className="rounded-2xl border border-dashed p-10 text-center text-muted-foreground">Nenhuma análise com esse filtro.</div>
      ) : !data?.rows.length ? (
        <div className="rounded-2xl border border-dashed p-10 text-center text-muted-foreground">
          Nenhuma análise ainda. <Link to="/app/nova-analise" className="font-semibold text-primary-ink">Fazer a primeira</Link>
        </div>
      ) : (
        <>
          <div className="hidden overflow-x-auto rounded-2xl border bg-card md:block">
            <table className="w-full min-w-[860px] text-sm">
              <thead className="border-b text-left text-muted-foreground">
                <tr>
                  <th className="p-3 font-medium">Peça</th><th className="p-3 font-medium">Fatiador</th><th className="p-3 font-medium">Antes → depois</th>
                  <th className="p-3 font-medium">Motor</th><th className="p-3 font-medium">Custo real</th><th className="p-3 font-medium">Estado</th><th className="p-3"><span className="sr-only">Ações</span></th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((j) => {
                  const est = ESTADOS[j.estado as Estado] ?? ESTADOS.na_fila;
                  const peca = j.nome_peca ?? "Peça aberta no fatiador";
                  const abrir = () => navigate({ to: "/app/analise/$id", params: { id: j.id } });
                  return (
                    <tr
                      key={j.id}
                      tabIndex={0}
                      aria-label={`Abrir análise de ${peca}`}
                      className="cursor-pointer border-b last:border-0 hover:bg-accent/60 focus-visible:bg-accent/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                      onClick={abrir}
                      onKeyDown={(e) => { if (e.key === "Enter" && e.target === e.currentTarget) abrir(); }}
                    >
                      <td className="p-3">
                        <Link to="/app/analise/$id" params={{ id: j.id }} onClick={(e) => e.stopPropagation()} className="font-medium text-primary-ink hover:underline">{peca}</Link>
                        <ResumoPedidoLinha opcoes={j.opcoes} roteiro={j.roteiro} data={j.criado_em} />
                      </td>
                      <td className="p-3">{rotuloFat(j.fatiador)}</td>
                      <td className="p-3 tabular">{antesDepois(j.resultado)}</td>
                      <td className="p-3">{motorLabel(j.motor)}</td>
                      <td className="p-3 tabular">{custo(j.motor, j.custo_real)}</td>
                      <td className="p-3"><Tag tone={est.tone}>{est.label}</Tag></td>
                      <td className="p-3">
                        <div className="flex flex-wrap items-center justify-end gap-1.5">
                          <Acoes j={j} onAbrirPasta={abrirPasta} onRepetir={(id) => navigate({ to: "/app/nova-analise", search: { repetir: id } })} />
                          <Button size="sm" onClick={(e) => { e.stopPropagation(); abrir(); }}>Ver análise<ChevronRight className="size-4" aria-hidden /></Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <ul className="space-y-3 md:hidden">
            {data.rows.map((j) => {
              const est = ESTADOS[j.estado as Estado] ?? ESTADOS.na_fila;
              const peca = j.nome_peca ?? "Peça aberta no fatiador";
              return (
                <li key={j.id} className="lift rounded-2xl border bg-card/70 p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <Link to="/app/analise/$id" params={{ id: j.id }} aria-label={`Abrir análise de ${peca}`} className="break-words font-medium text-primary-ink hover:underline">{peca}</Link>
                      <ResumoPedidoLinha opcoes={j.opcoes} roteiro={j.roteiro} data={j.criado_em} />
                    </div>
                    <Tag tone={est.tone}>{est.label}</Tag>
                  </div>
                  <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
                    <div><dt className="text-xs text-muted-foreground">Fatiador</dt><dd>{rotuloFat(j.fatiador)}</dd></div>
                    <div><dt className="text-xs text-muted-foreground">Antes → depois</dt><dd className="tabular">{antesDepois(j.resultado)}</dd></div>
                    <div><dt className="text-xs text-muted-foreground">Motor</dt><dd>{motorLabel(j.motor)}</dd></div>
                    <div><dt className="text-xs text-muted-foreground">Custo real</dt><dd className="tabular">{custo(j.motor, j.custo_real)}</dd></div>
                  </dl>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    <Acoes j={j} onAbrirPasta={abrirPasta} onRepetir={(id) => navigate({ to: "/app/nova-analise", search: { repetir: id } })} />
                  </div>
                  <Button className="mt-3 w-full" onClick={() => navigate({ to: "/app/analise/$id", params: { id: j.id } })}>Ver análise<ChevronRight className="size-4" aria-hidden /></Button>
                </li>
              );
            })}
          </ul>
        </>
      )}
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">Página {pagina + 1} de {totalPaginas} · {data?.total ?? 0} análises</span>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" disabled={pagina === 0} onClick={() => navigate({ to: "/app/historico", search: { ...search, pagina: pagina - 1 } })}>Anterior</Button>
          <Button variant="outline" size="sm" disabled={pagina + 1 >= totalPaginas} onClick={() => navigate({ to: "/app/historico", search: { ...search, pagina: pagina + 1 } })}>Próxima</Button>
        </div>
      </div>
    </div>
  );
}

interface AcoesProps {
  j: Tables<"jobs">;
  onAbrirPasta: (jobId: string, deviceId: string | null) => void;
  onRepetir: (jobId: string) => void;
}

function Acoes({ j, onAbrirPasta, onRepetir }: AcoesProps) {
  return (
    <>
      {j.estado === "concluido" && arquivoDoResultado(j.resultado) && (
        <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); onAbrirPasta(j.id, j.device_id); }}>Abrir pasta</Button>
      )}
      <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); onRepetir(j.id); }}>Repetir</Button>
      <span onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()} className="contents">
        <SalvarModeloDialog job={j} />
        <SalvarBibliotecaDialog job={j} />
      </span>
    </>
  );
}
