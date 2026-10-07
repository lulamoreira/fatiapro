import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { z } from "zod";
import { devicesQuery, historicoQuery, resumoMesQuery, PAGE_SIZE } from "@/lib/queries";
import { ESTADOS, fatiadorLabel, formatDuracao, formatUSD, isConectado, motorLabel, roteiroLabel, type Estado } from "@/lib/fatia";
import { Tag } from "@/components/fatia/Chip";
import { arquivoDoResultado, avisoAcao } from "@/components/fatia/ArquivoCard";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_authenticated/app/historico")({
  validateSearch: z.object({ pagina: z.number().int().min(0).catch(0).default(0) }),
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
  const { pagina } = Route.useSearch();
  const navigate = useNavigate();
  const { data: devices = [] } = useQuery(devicesQuery);
  async function abrirPasta(jobId: string, deviceId: string | null) {
    const { error } = await supabase.from("job_events").insert({ job_id: jobId, tipo: "acao", conteudo: { acao: "abrir_pasta" } });
    if (error) { toast.error("Não foi possível enviar o pedido."); return; }
    const d = devices.find((x) => x.id === deviceId);
    toast.success(avisoAcao(isConectado(d?.ultimo_contato, Date.now())));
  }
  const { data, isLoading } = useQuery({ ...historicoQuery(pagina), placeholderData: keepPreviousData });
  const { data: resumo } = useQuery(resumoMesQuery);
  const totalPaginas = Math.max(1, Math.ceil((data?.total ?? 0) / PAGE_SIZE));

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <h1 className="text-3xl font-bold">Histórico</h1>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border bg-card p-5">
          <p className="text-sm text-muted-foreground">Gasto na API este mês</p>
          <p className="mt-1 font-display text-3xl font-bold tabular">{resumo ? formatUSD(resumo.usd) : "…"}</p>
        </div>
        <div className="rounded-2xl border bg-card p-5">
          <p className="text-sm text-muted-foreground">Análises pela assinatura este mês</p>
          <p className="mt-1 font-display text-3xl font-bold tabular">{resumo ? resumo.assinatura : "…"}</p>
        </div>
      </div>

      {isLoading ? (
        <Skeleton className="h-64 rounded-2xl" />
      ) : !data?.rows.length ? (
        <div className="rounded-2xl border border-dashed p-10 text-center text-muted-foreground">
          Nenhuma análise ainda. <Link to="/app/nova-analise" className="font-semibold text-primary">Fazer a primeira</Link>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border bg-card">
          <table className="w-full min-w-[820px] text-sm">
            <thead className="border-b text-left text-muted-foreground">
              <tr>
                <th className="p-3 font-medium">Peça</th><th className="p-3 font-medium">Fatiador</th><th className="p-3 font-medium">Antes → depois</th>
                <th className="p-3 font-medium">Motor</th><th className="p-3 font-medium">Custo real</th><th className="p-3 font-medium">Estado</th><th className="p-3" />
              </tr>
            </thead>
            <tbody>
              {data.rows.map((j) => {
                const est = ESTADOS[j.estado as Estado] ?? ESTADOS.na_fila;
                return (
                  <tr key={j.id} className="cursor-pointer border-b last:border-0 hover:bg-accent/50" onClick={() => navigate({ to: "/app/analise/$id", params: { id: j.id } })}>
                    <td className="p-3">
                      <p className="font-medium">{j.nome_peca ?? "Peça aberta no fatiador"}</p>
                      <p className="text-xs text-muted-foreground">{roteiroLabel(j.roteiro)} · {new Date(j.criado_em).toLocaleDateString("pt-BR")}</p>
                    </td>
                    <td className="p-3">{fatiadorLabel(j.fatiador)}</td>
                    <td className="p-3 tabular">{antesDepois(j.resultado)}</td>
                    <td className="p-3">{motorLabel(j.motor)}</td>
                    <td className="p-3 tabular">{custo(j.motor, j.custo_real)}</td>
                    <td className="p-3"><Tag tone={est.tone}>{est.label}</Tag></td>
                    <td className="space-x-2 whitespace-nowrap p-3 text-right">
                      {j.estado === "concluido" && arquivoDoResultado(j.resultado) && (
                        <Button size="sm" onClick={(e) => { e.stopPropagation(); abrirPasta(j.id, j.device_id); }}>Abrir pasta</Button>
                      )}
                      <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); navigate({ to: "/app/nova-analise", search: { repetir: j.id } }); }}>
                        Repetir com outras opções
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">Página {pagina + 1} de {totalPaginas} · {data?.total ?? 0} análises</span>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" disabled={pagina === 0} onClick={() => navigate({ to: "/app/historico", search: { pagina: pagina - 1 } })}>Anterior</Button>
          <Button variant="outline" size="sm" disabled={pagina + 1 >= totalPaginas} onClick={() => navigate({ to: "/app/historico", search: { pagina: pagina + 1 } })}>Próxima</Button>
        </div>
      </div>
    </div>
  );
}
