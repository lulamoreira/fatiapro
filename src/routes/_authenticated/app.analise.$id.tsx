import { useFatiadorLabel } from "@/hooks/use-fatiador-label";
import { nomePecaExibicao } from "@/lib/nome-peca";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { criarAnalise } from "@/lib/analise.functions";
import { erroAnalise, etiquetaFonte, type ErroAnalise } from "@/lib/plano";
import { ErroAnaliseAviso } from "@/components/fatia/ErroAnaliseAviso";
import { Questionario } from "@/components/fatia/Questionario";
import { PecaAbertaEvento } from "@/components/fatia/PecaAberta";
import { MessageSquareHeart } from "lucide-react";
import type { Json } from "@/integrations/supabase/types";
import { jobEventsQuery, jobQuery } from "@/lib/queries";
import { ResumoPedidoLinha } from "@/components/fatia/ResumoPedido";
import { ESTADOS, fatiadorLabel, isConectado, type Estado } from "@/lib/fatia";
import { useNow } from "@/hooks/use-now";
import { useDevicesLive } from "@/hooks/use-devices-live";
import { SalvarModeloDialog } from "@/components/fatia/SalvarModeloDialog";
import { SalvarBibliotecaDialog } from "@/components/fatia/SalvarBibliotecaDialog";
import { FecharAnaliseDialog } from "@/components/fatia/FecharAnaliseDialog";
import { Check } from "lucide-react";
import { WorkingCard, type Fase } from "@/components/fatia/WorkingCard";
import { FraseAnimo } from "@/components/fatia/FraseAnimo";
import { podeMostrarAnimo } from "@/lib/frases-animo";
import { ArquivoCard, arquivoDoResultado, avisoAcao, type AcaoArquivo } from "@/components/fatia/ArquivoCard";
import { Tag } from "@/components/fatia/Chip";
import { Approval, type Proposta } from "@/components/fatia/Approval";
import { Result, type ResultadoConteudo } from "@/components/fatia/Result";
import { GerarOrcamento } from "@/components/fatia/GerarOrcamento";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_authenticated/app/analise/$id")({
  head: () => ({ meta: [{ title: "Análise — FatiaPro" }, { name: "description", content: "Acompanhe a análise ao vivo e aprove as mudanças." }, { property: "og:title", content: "Análise — FatiaPro" }, { property: "og:description", content: "Acompanhe a análise ao vivo e aprove as mudanças." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: AnalisePage,
});

const TERMINAIS: Estado[] = ["concluido", "erro", "cancelado", "limite_de_gasto"];

function AnalisePage() {
  const rotuloFat = useFatiadorLabel();
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { data: job, isLoading } = useQuery(jobQuery(id));
  const { data: eventos = [] } = useQuery(jobEventsQuery(id));
  const now = useNow(1000);
  useDevicesLive();
  /** Optimistic phase set on click, before server/bridge confirm. */
  const [erroRep, setErroRep] = useState<ErroAnalise | null>(null);
  const [questJob, setQuestJob] = useState<string | null>(null);
  const [repetirAposQuest, setRepetirAposQuest] = useState(false);
  const [pendRep, setPendRep] = useState<string | null>(null);
  const { data: feedback, isFetched: feedbackLido } = useQuery({
    queryKey: ["feedback", id],
    queryFn: async () => (await supabase.from("feedback_respostas").select("id").eq("job_id", id).maybeSingle()).data,
  });
  const [pendente, setPendente] = useState<{ fase: "aplicando" | "outra"; at: number } | null>(null);
  const workingRef = useRef<HTMLElement>(null);
  const deviceId = job?.device_id ?? null;
  const { data: device } = useQuery({
    queryKey: ["device_sinal", deviceId],
    enabled: !!deviceId,
    refetchInterval: 15_000,
    queryFn: async () => {
      const { data, error } = await supabase.from("devices").select("id, ultimo_contato").eq("id", deviceId!).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (!deviceId) return undefined;
    const ch = supabase
      .channel(`device-${deviceId}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "devices", filter: `id=eq.${deviceId}` }, () => qc.invalidateQueries({ queryKey: ["device_sinal", deviceId] }))
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [deviceId, qc]);

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
    mutationFn: async (ev: { tipo: "aprovacao" | "pedido_outra" | "cancelamento" | "acao"; conteudo: Json }) => {
      const { error } = await supabase.from("job_events").insert({ job_id: id, tipo: ev.tipo, conteudo: ev.conteudo });
      if (error) throw error;
      if (ev.tipo === "cancelamento") {
        const { error: e2 } = await supabase.from("jobs").update({ estado: "cancelado" }).eq("id", id);
        if (e2) throw e2;
      }
    },
    onSuccess: async () => {
      await Promise.all([qc.invalidateQueries({ queryKey: ["job_events", id] }), qc.invalidateQueries({ queryKey: ["job", id] })]);
      setPendente(null); // events now carry the real phase
    },
    onError: () => {
      setPendente(null);
      toast.error("Não foi possível enviar.");
    },
  });

  const repetir = useMutation({
    mutationFn: async () => {
      if (!job) throw new Error("sem job");
      if (!job.device_id) throw new Error("Escolha um computador.");
      const r = await criarAnalise({
        data: {
          device_id: job.device_id,
          roteiro: job.roteiro as "config_geral",
          fatiador: job.fatiador,
          opcoes: (job.opcoes ?? {}) as Record<string, unknown>,
          motor: job.motor === "api" || job.motor === "assinatura" ? job.motor : "fatiapro",
          premium: !!(job as { premium?: boolean }).premium,
          arquivo_path: job.arquivo_path,
          nome_peca: job.nome_peca,
        },
      });
      return r;
    },
    onSuccess: (r) => {
      if ("erro" in r) {
        const e = erroAnalise(r.codigo, r.detalhe);
        setErroRep(e);
        if (e.acao === "questionario" && r.job_pendente) { setPendRep(r.job_pendente); setRepetirAposQuest(true); setQuestJob(r.job_pendente); }
        return;
      }
      setErroRep(null);
      qc.invalidateQueries({ queryKey: ["meu-plano"] });
      navigate({ to: "/app/analise/$id", params: { id: r.job_id } });
    },
    onError: (e) => toast.warning(e instanceof Error ? e.message : "Não foi possível criar a nova análise."),
  });

  if (isLoading) return <Skeleton className="mx-auto h-64 max-w-4xl rounded-3xl" />;
  if (!job)
    return (
      <div className="mx-auto max-w-md text-center">
        <p>Análise não encontrada.</p>
        <Link to="/app/historico" className="font-semibold text-primary-ink">Ver histórico</Link>
      </div>
    );

  const estado = (job.estado as Estado) ?? "na_fila";
  const est = ESTADOS[estado];
  const opc = (job.opcoes ?? {}) as { impressora?: string; filamento?: { tipo?: string; marca?: string; linha?: string } };
  const progresso = eventos.filter((e) => e.tipo === "progresso");
  type Ev = (typeof eventos)[number];
  const ultimo = (tipo: string): { ev: Ev; idx: number } | null => {
    for (let i = eventos.length - 1; i >= 0; i--) { const ev = eventos[i]; if (ev && ev.tipo === tipo) return { ev, idx: i }; }
    return null;
  };
  const prop = ultimo("proposta");
  const idxProposta = prop?.idx ?? -1;
  const respondida = idxProposta >= 0 && eventos.slice(idxProposta + 1).some((e) => e.tipo === "aprovacao" || e.tipo === "pedido_outra" || e.tipo === "cancelamento");
  const mostrarAprovacao = !!prop && !respondida && !pendente && !TERMINAIS.includes(estado);
  const terminal = TERMINAIS.includes(estado);
  const ts = (e: Ev) => Date.parse(e.criado_em);

  // Last user response after the last proposal defines the apply/other phase.
  let ue: Ev | null = null;
  for (let i = eventos.length - 1; i > idxProposta; i--) { const e = eventos[i]; if (e && (e.tipo === "aprovacao" || e.tipo === "pedido_outra")) { ue = e; break; } }
  let fase: Fase;
  let desde: number;
  let marcoAprovacao: number | null = null;
  if (pendente) { fase = pendente.fase; desde = pendente.at; if (fase === "aplicando") marcoAprovacao = pendente.at; }
  else if (ue) { fase = ue.tipo === "aprovacao" ? "aplicando" : "outra"; desde = ts(ue); if (fase === "aplicando") marcoAprovacao = desde; }
  else if (estado === "aplicando") { fase = "aplicando"; desde = Date.parse(job.atualizado_em); marcoAprovacao = desde; }
  else if (estado === "na_fila") { fase = "na_fila"; desde = Date.parse(job.criado_em); }
  else { fase = "analisando"; desde = prop ? ts(prop.ev) : Date.parse(job.atualizado_em); }
  const posAprovacao = marcoAprovacao != null && ue ? eventos.slice(eventos.indexOf(ue) + 1) : [];
  const passos = fase === "aplicando"
    ? { aplicou: posAprovacao.some((e) => e.tipo === "progresso"), resultado: posAprovacao.some((e) => e.tipo === "resultado") }
    : undefined;
  const ultimoProg = progresso[progresso.length - 1];
  const ultimaMensagem = ultimoProg ? String((ultimoProg.conteudo as { texto?: unknown })?.texto ?? "") || null : null;
  const ultimoEv = eventos[eventos.length - 1];
  const semEventosMs = now - Math.max(desde, ultimoEv ? ts(ultimoEv) : 0);
  const ultimoContatoMs = device?.ultimo_contato ? Date.parse(device.ultimo_contato) : null;
  const conectado = isConectado(device?.ultimo_contato, now);
  const mostrarTrabalhando = !terminal && !mostrarAprovacao;

  const arquivo = estado === "concluido" ? arquivoDoResultado(job.resultado) : null;
  const ultimaAcao = ultimo("acao");
  const confirmacaoAcao = ultimaAcao
    ? (() => { const p = eventos.slice(ultimaAcao.idx + 1).filter((e) => e.tipo === "progresso").pop(); return p ? String((p.conteudo as { texto?: unknown })?.texto ?? "") || null : null; })()
    : null;

  function aprovar(ids: string[]) {
    setPendente({ fase: "aplicando", at: Date.now() });
    requestAnimationFrame(() => workingRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
    enviar.mutate({ tipo: "aprovacao", conteudo: { itens_aprovados: ids } });
  }
  function pedirOutra(texto: string) {
    setPendente({ fase: "outra", at: Date.now() });
    requestAnimationFrame(() => workingRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
    enviar.mutate({ tipo: "pedido_outra", conteudo: { texto } });
  }
  function acao(a: AcaoArquivo) {
    enviar.mutate({ tipo: "acao", conteudo: { acao: a } }, { onSuccess: () => toast.success(avisoAcao(conectado)) });
  }
  const resultado = ultimo("resultado")?.ev;
  const erroEv = ultimo("erro")?.ev;
  const podeCancelar = !TERMINAIS.includes(estado);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link to="/app/historico" search={{ pagina: 0 }} className="inline-flex text-sm font-medium text-muted-foreground hover:text-primary-ink">← Voltar ao histórico</Link>
        {estado === "concluido" && <FecharAnaliseDialog job={job} />}
        {(estado === "erro" || estado === "cancelado") && (
          <Button asChild size="sm" variant="outline"><Link to="/app/historico" search={{ pagina: 0 }}><Check className="size-4" aria-hidden />Fechar</Link></Button>
        )}
      </div>
      <header className="rounded-3xl border bg-card p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">{nomePecaExibicao(job.nome_peca)}</h1>
            <ResumoPedidoLinha opcoes={job.opcoes} roteiro={job.roteiro} extra={job.fatiador ? rotuloFat(job.fatiador) : undefined} data={job.criado_em} />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {etiquetaFonte(job) && <Tag tone={etiquetaFonte(job) === "Crédito devolvido" ? "success" : "muted"}>{etiquetaFonte(job)}</Tag>}
            <Tag tone={est.tone} className="text-sm">{est.label}</Tag>
          </div>
        </div>
        {estado === "concluido" && (
          <div className="mt-4 flex flex-wrap gap-2">
            <SalvarModeloDialog job={job} trigger="button" />
            <SalvarBibliotecaDialog job={job} trigger="button" />
          </div>
        )}
        {podeCancelar && !mostrarAprovacao && (
          <div className="mt-4 flex justify-end">
            <Button variant="ghost" size="sm" onClick={() => enviar.mutate({ tipo: "cancelamento", conteudo: {} })}>Cancelar análise</Button>
          </div>
        )}
      </header>

      {mostrarTrabalhando && (
        <WorkingCard
          ref={workingRef}
          fase={fase}
          ultimaMensagem={ultimaMensagem}
          desdeMs={desde}
          now={now}
          {...(passos ? { passos } : {})}
          ultimoContatoMs={ultimoContatoMs}
          semEventosMs={semEventosMs}
          onCancelar={() => enviar.mutate({ tipo: "cancelamento", conteudo: {} })}
        />
      )}

      <FraseAnimo
        key={`${id}-${mostrarTrabalhando}`}
        ativa={mostrarTrabalhando && podeMostrarAnimo(estado, (!!prop && !respondida) || !!resultado || !!erroEv || !!ultimo("cancelamento"))}
        inicioMs={Date.parse(job.criado_em)}
      />

      <section aria-label="Linha do tempo" className="rounded-3xl border bg-card p-6">
        <h2 className="text-sm font-semibold">Linha do tempo</h2>
        {progresso.length === 0 ? (
          <p className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
            {!TERMINAIS.includes(estado) && <Loader2 className="size-4 animate-spin" aria-hidden />}
            {estado === "na_fila" ? "Aguardando o computador pegar o pedido…" : "Sem eventos ainda."}
          </p>
        ) : (
          <ol className="mt-3 space-y-3 border-l-2 border-border pl-4" aria-live="polite">
            {progresso.map((e, i) => (
              <li key={e.id} className="relative">
                <span className="absolute -left-[1.4rem] top-1.5 size-2.5 rounded-full bg-primary" aria-hidden />
                <p className="flex items-center gap-2 text-sm">
                  {!terminal && i === progresso.length - 1 && <Loader2 className="size-3.5 shrink-0 animate-spin text-primary-ink" aria-label="em andamento" />}<PecaAbertaEvento texto={String((e.conteudo as { texto?: unknown })?.texto ?? "")} /></p>
                <p className="text-xs text-muted-foreground">{new Date(e.criado_em).toLocaleTimeString("pt-BR")}</p>
              </li>
            ))}
          </ol>
        )}
      </section>

      {mostrarAprovacao && prop && (
        <Approval
          key={prop.ev.id}
          proposta={prop.ev.conteudo as unknown as Proposta}
          disabled={enviar.isPending}
          onAprovar={aprovar}
          onPedirOutra={pedirOutra}
          onCancelar={() => enviar.mutate({ tipo: "cancelamento", conteudo: {} })}
        />
      )}

      {arquivo && (
        <ArquivoCard arquivoLocal={arquivo.arquivoLocal} pastaLocal={arquivo.pastaLocal} confirmacao={confirmacaoAcao} disabled={enviar.isPending} onAcao={acao} />
      )}

      {resultado && <Result c={resultado.conteudo as unknown as ResultadoConteudo} motor={job.motor} custo={job.custo_real} />}
      {resultado && estado === "concluido" && job.roteiro === "preco" && <GerarOrcamento jobId={job.id} nomePeca={job.nome_peca} conteudo={resultado.conteudo} />}
      {estado === "concluido" && job.fonte === "teste" && feedbackLido && !feedback && (
        <button type="button" onClick={() => { setRepetirAposQuest(false); setQuestJob(job.id); }}
          className="flex w-full items-center gap-3 rounded-2xl border bg-card p-4 text-left text-sm hover:bg-secondary">
          <MessageSquareHeart className="size-5 text-primary-ink" aria-hidden />
          <span><span className="block font-semibold">Conte como foi</span><span className="block text-xs text-muted-foreground">Leva 20 segundos e libera a otimização de hoje.</span></span>
        </button>
      )}
      {estado === "concluido" && <div className="flex justify-end"><FecharAnaliseDialog job={job} /></div>}
      <Questionario jobId={questJob} onOpenChange={(o) => { if (!o) setQuestJob(null); }} onEnviado={() => { if (repetirAposQuest) repetir.mutate(); }} />

      {estado === "erro" && (
        <div className="rounded-2xl border border-destructive bg-destructive/10 p-5" role="alert">
          <p className="text-sm font-medium text-destructive">{String((erroEv?.conteudo as { mensagem?: unknown })?.mensagem ?? "A análise falhou.")}</p>
          <Button className="mt-3" variant="destructive" size="sm" disabled={repetir.isPending} onClick={() => repetir.mutate()}>Tentar de novo</Button>
          {erroRep && <div className="mt-3"><ErroAnaliseAviso erro={erroRep} onQuestionario={() => { setRepetirAposQuest(true); setQuestJob(pendRep); }} /></div>}
        </div>
      )}
      {estado === "limite_de_gasto" && (
        <div className="rounded-2xl border border-destructive bg-destructive/10 p-5 text-sm" role="alert">
          A análise parou porque chegou no limite de gasto do computador. Ajuste em <Link to="/app/configuracoes" className="font-semibold underline">Configurações</Link>.
        </div>
      )}
    </div>
  );
}
