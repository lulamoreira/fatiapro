import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useEffect } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { jobEventsQuery, jobQuery } from "@/lib/queries";
import { ESTADOS, fatiadorLabel, roteiroLabel, type Estado } from "@/lib/fatia";
import { Tag } from "@/components/fatia/Chip";
import { Approval, type Proposta } from "@/components/fatia/Approval";
import { Result, type ResultadoConteudo } from "@/components/fatia/Result";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_authenticated/app/analise/$id")({
  head: () => ({ meta: [{ title: "Análise — FatiaPro" }, { name: "description", content: "Acompanhe a análise ao vivo e aprove as mudanças." }] }),
  component: AnalisePage,
});

const TERMINAIS: Estado[] = ["concluido", "erro", "cancelado", "limite_de_gasto"];

function AnalisePage() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { data: job, isLoading } = useQuery(jobQuery(id));
  const { data: eventos = [] } = useQuery(jobEventsQuery(id));

  useEffect(() => {
    const ch = supabase
      .channel(`job-${id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "job_events", filter: `job_id=eq.${id}` }, () => qc.invalidateQueries({ queryKey: ["job_events", id] }))
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "jobs", filter: `id=eq.${id}` }, () => qc.invalidateQueries({ queryKey: ["job", id] }))
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [id, qc]);

  const enviar = useMutation({
    mutationFn: async (ev: { tipo: "aprovacao" | "pedido_outra" | "cancelamento"; conteudo: Json }) => {
      const { error } = await supabase.from("job_events").insert({ job_id: id, tipo: ev.tipo, conteudo: ev.conteudo });
      if (error) throw error;
      if (ev.tipo === "cancelamento") {
        const { error: e2 } = await supabase.from("jobs").update({ estado: "cancelado" }).eq("id", id);
        if (e2) throw e2;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["job_events", id] });
      qc.invalidateQueries({ queryKey: ["job", id] });
    },
    onError: () => toast.error("Não foi possível enviar."),
  });

  const repetir = useMutation({
    mutationFn: async () => {
      if (!job) throw new Error("sem job");
      const { data, error } = await supabase
        .from("jobs")
        .insert({ device_id: job.device_id, roteiro: job.roteiro, fatiador: job.fatiador, opcoes: job.opcoes, motor: job.motor, arquivo_path: job.arquivo_path, nome_peca: job.nome_peca })
        .select("id")
        .single();
      if (error) throw error;
      return data.id;
    },
    onSuccess: (nid) => navigate({ to: "/app/analise/$id", params: { id: nid } }),
    onError: () => toast.error("Não foi possível criar a nova análise."),
  });

  if (isLoading) return <Skeleton className="mx-auto h-64 max-w-4xl rounded-3xl" />;
  if (!job)
    return (
      <div className="mx-auto max-w-md text-center">
        <p>Análise não encontrada.</p>
        <Link to="/app/historico" className="font-semibold text-primary">Ver histórico</Link>
      </div>
    );

  const estado = (job.estado as Estado) ?? "na_fila";
  const est = ESTADOS[estado];
  const opc = (job.opcoes ?? {}) as { impressora?: string; filamento?: { tipo?: string; marca?: string; linha?: string } };
  const progresso = eventos.filter((e) => e.tipo === "progresso");
  const idxProposta = eventos.findLastIndex((e) => e.tipo === "proposta");
  const respondida = idxProposta >= 0 && eventos.slice(idxProposta + 1).some((e) => e.tipo === "aprovacao" || e.tipo === "pedido_outra" || e.tipo === "cancelamento");
  const mostrarAprovacao = idxProposta >= 0 && !respondida && !TERMINAIS.includes(estado);
  const resultado = eventos.findLast((e) => e.tipo === "resultado");
  const erroEv = eventos.findLast((e) => e.tipo === "erro");
  const podeCancelar = !TERMINAIS.includes(estado);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header className="rounded-3xl border bg-card p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">{job.nome_peca ?? "Peça aberta no fatiador"}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {roteiroLabel(job.roteiro)} · {fatiadorLabel(job.fatiador)}
              {opc.impressora ? ` · ${opc.impressora}` : ""}
              {opc.filamento?.tipo ? ` · ${[opc.filamento.marca, opc.filamento.linha].filter(Boolean).join(" ")}` : ""}
            </p>
          </div>
          <Tag tone={est.tone} className="text-sm">{est.label}</Tag>
        </div>
        {podeCancelar && !mostrarAprovacao && (
          <div className="mt-4 flex justify-end">
            <Button variant="ghost" size="sm" onClick={() => enviar.mutate({ tipo: "cancelamento", conteudo: {} })}>Cancelar análise</Button>
          </div>
        )}
      </header>

      <section aria-label="Linha do tempo" className="rounded-3xl border bg-card p-6">
        <h2 className="text-sm font-semibold">Linha do tempo</h2>
        {progresso.length === 0 ? (
          <p className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
            {!TERMINAIS.includes(estado) && <Loader2 className="size-4 animate-spin" aria-hidden />}
            {estado === "na_fila" ? "Aguardando o computador pegar o pedido…" : "Sem eventos ainda."}
          </p>
        ) : (
          <ol className="mt-3 space-y-3 border-l-2 border-border pl-4" aria-live="polite">
            {progresso.map((e) => (
              <li key={e.id} className="relative">
                <span className="absolute -left-[1.4rem] top-1.5 size-2.5 rounded-full bg-primary" aria-hidden />
                <p className="text-sm">{String((e.conteudo as { texto?: unknown })?.texto ?? "")}</p>
                <p className="text-xs text-muted-foreground">{new Date(e.criado_em).toLocaleTimeString("pt-BR")}</p>
              </li>
            ))}
          </ol>
        )}
      </section>

      {mostrarAprovacao && (
        <Approval
          key={eventos[idxProposta].id}
          proposta={eventos[idxProposta].conteudo as unknown as Proposta}
          disabled={enviar.isPending}
          onAprovar={(ids) => enviar.mutate({ tipo: "aprovacao", conteudo: { itens_aprovados: ids } })}
          onPedirOutra={(texto) => enviar.mutate({ tipo: "pedido_outra", conteudo: { texto } })}
          onCancelar={() => enviar.mutate({ tipo: "cancelamento", conteudo: {} })}
        />
      )}

      {resultado && <Result c={resultado.conteudo as unknown as ResultadoConteudo} motor={job.motor} custo={job.custo_real} />}

      {estado === "erro" && (
        <div className="rounded-2xl border border-destructive bg-destructive/10 p-5" role="alert">
          <p className="text-sm font-medium text-destructive">{String((erroEv?.conteudo as { mensagem?: unknown })?.mensagem ?? "A análise falhou.")}</p>
          <Button className="mt-3" variant="destructive" size="sm" disabled={repetir.isPending} onClick={() => repetir.mutate()}>Tentar de novo</Button>
        </div>
      )}
      {estado === "limite_de_gasto" && (
        <div className="rounded-2xl border border-destructive bg-destructive/10 p-5 text-sm" role="alert">
          A análise parou porque chegou no limite de gasto do computador. Ajuste em <Link to="/app/computador" className="font-semibold underline">Seu computador</Link>.
        </div>
      )}
    </div>
  );
}
