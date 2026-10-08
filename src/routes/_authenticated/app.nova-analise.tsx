import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useIsAdmin } from "@/hooks/use-is-admin";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { Upload, FileBox, BookmarkPlus, ChevronDown, ChevronUp, ArrowRight, Bookmark, Check, CheckCircle2, ShieldCheck, Settings2, Timer, ListChecks, BadgeDollarSign } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { criarAnalise } from "@/lib/analise.functions";
import { usePlano } from "@/hooks/use-plano";
import { erroAnalise, linhaUso, motoresVisiveis, ponteDesatualizada, roteiroComCredito, usaTeste, DIAS_TESTE, type ErroAnalise } from "@/lib/plano";
import { ErroAnaliseAviso } from "@/components/fatia/ErroAnaliseAviso";
import { Questionario } from "@/components/fatia/Questionario";
import { Switch } from "@/components/ui/switch";
import { Wallet } from "lucide-react";
import type { Json } from "@/integrations/supabase/types";
import { devicesQuery, presetsQuery } from "@/lib/queries";
import {
  BICOS, fatiadorLabel, nomeFatiador, nomeArquivoCompleto, FINALIDADES, MARCA_GENERICA, gruposMarca, grupoDaMarca, linhasDaMarca, materialTexto, PRIORIDADES, ROTEIROS, TIPOS_FILAMENTO,
  isConectado, maquinaResumo, nomeArquivoOtimizado, parseRelatorio, togglePrioridade,
} from "@/lib/fatia";
import { escolherMotor } from "@/lib/motor-choice";
import { MotorChoice } from "@/components/fatia/MotorChoice";
import { useNow } from "@/hooks/use-now";
import { useDevicesLive } from "@/hooks/use-devices-live";
import { EnviarComando } from "@/components/fatia/EnviarComando";
import { BibliotecaPicker, type PecaEscolhida } from "@/components/fatia/BibliotecaPicker";
import type { AjusteModelo } from "@/components/fatia/SalvarModeloDialog";
import { caminhoOriginal, extensaoPermitida, nomeDownloadOriginal } from "@/lib/nomes";
import { X } from "lucide-react";
import { AlertTriangle } from "lucide-react";
import { Chip, Dot, IconTile, PageHeader, Segmented } from "@/components/fatia/Chip";
import { Combobox } from "@/components/fatia/Combobox";
import { ApiKeyWizard } from "@/components/fatia/ApiKeyWizard";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { CostCard, useCustoCurto } from "@/components/fatia/CostCard";
import { PrecoFields } from "@/components/fatia/PrecoFields";
import { EXTENSOES, FORM_INICIAL, MAX_BYTES, fromOpcoes, toOpcoes, validar, type Erros, type FormState } from "@/components/fatia/form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/app/nova-analise")({
  validateSearch: z.object({ repetir: z.string().uuid().optional().catch(undefined), modelo: z.string().uuid().optional().catch(undefined), peca: z.string().uuid().optional().catch(undefined) }),
  head: () => ({ meta: [{ title: "Nova análise — FatiaPro" }, { name: "description", content: "Peça uma nova análise de fatiamento ao seu computador." }] }),
  component: NovaAnalise,
});

const Erro = ({ children }: { children: ReactNode }) => <p className="text-xs font-medium text-destructive-ink" role="alert">{children}</p>;

function Secao({ id, n, ok, titulo, subtitulo, children }: { id: string; n: number | string; ok: boolean; titulo: string; subtitulo?: string; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-t`} className="scroll-mt-6 space-y-4 rounded-2xl border bg-card p-5 md:p-[22px]">
      <header className="flex items-center gap-3">
        <span aria-hidden className={cn("flex size-[30px] shrink-0 items-center justify-center rounded-full text-sm font-bold text-primary-foreground", ok ? "bg-g-green" : "bg-g-blue")}>
          {ok ? <Check className="size-4" /> : n}
        </span>
        <div className="min-w-0">
          <h2 id={`${id}-t`} className="text-[17px] font-semibold leading-tight">{titulo}</h2>
          {subtitulo && <p className="text-[13px] text-muted-foreground">{subtitulo}</p>}
        </div>
      </header>
      {children}
    </section>
  );
}

const ROTEIRO_CARDS = [
  { id: "config_geral", titulo: "Configurar a peça", linha: "Orientação, suporte, paredes e camada", icon: Settings2, tone: "blue" },
  { id: "reduzir_tempo", titulo: "Reduzir tempo", linha: "Sem piorar o que o cliente vê", icon: Timer, tone: "orange" },
  { id: "checklist", titulo: "Conferir antes de imprimir", linha: "Checklist com ok e atenção", icon: ListChecks, tone: "green" },
  { id: "preco", titulo: "Preço de venda", linha: "Custos e três sugestões de preço", icon: BadgeDollarSign, tone: "purple" },
] as const;

/** First section with a validation error, in screen order. */
const SECAO_DO_ERRO = (k: string) =>
  k === "roteiro" ? "sec-1" : k === "peca" ? "sec-2" : ["fatiador", "impressora", "filamento", "tempBico", "tempMesa"].includes(k) ? "sec-3" : k === "motor" || k === "device" ? "sec-motor" : "sec-3b";
const ORDEM = ["sec-1", "sec-2", "sec-3", "sec-3b", "sec-4", "sec-motor"];

function NovaAnalise() {
  const { repetir, modelo, peca } = Route.useSearch();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const now = useNow(5000);
  useDevicesLive();
  /** null = use the computer's default folder. */
  const [pastaSaida, setPastaSaida] = useState<string | null>(null);
  const { data: devices = [] } = useQuery(devicesQuery);
  const { data: presets = [] } = useQuery(presetsQuery);
  const [form, setF] = useState<FormState>(FORM_INICIAL);
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [erros, setErros] = useState<Erros>({});
  const [enviando, setEnviando] = useState(false);
  const [pecaBib, setPecaBib] = useState<PecaEscolhida | null>(null);
  const [ajustes, setAjustes] = useState<AjusteModelo[]>([]);
  /** Model chosen in "Usar um modelo"; recorded on the job as opcoes.modelo_id/modelo_nome. */
  const [modeloSel, setModeloSel] = useState<{ id: string; nome: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const isAdmin = useIsAdmin();
  const device = devices.find((d) => d.id === form.deviceId);
  const rel = useMemo(() => parseRelatorio(device?.relatorio), [device?.relatorio]);
  const motoresOk = motoresVisiveis(isAdmin, rel.motores);
  const { data: plano } = usePlano();
  const [premiumOn, setPremiumOn] = useState(false);
  const [erroCriar, setErroCriar] = useState<ErroAnalise | null>(null);
  const [pendente, setPendente] = useState<string | null>(null);
  const [questJob, setQuestJob] = useState<string | null>(null);
  const { data: ultimoMotor } = useQuery({
    queryKey: ["ultimo-motor"],
    queryFn: async () => {
      const { data, error } = await supabase.from("jobs").select("motor", { count: "exact" })
        .order("criado_em", { ascending: false }).order("id", { ascending: false }).range(0, 0);
      if (error) throw error;
      return data?.[0]?.motor ?? null;
    },
    staleTime: 60_000,
  });
  const f: FormState = { ...form, motor: escolherMotor(form.motor, ultimoMotor, motoresOk) };
  const usaFatiaPro = f.motor === "fatiapro";
  const premiumPossivel = usaFatiaPro && roteiroComCredito(f.roteiro);
  const premiumTravado = !!plano && usaTeste(plano);
  const premium = premiumPossivel && !premiumTravado && premiumOn;
  const ponteVelha = !!device && usaFatiaPro && ponteDesatualizada(device.versao_ponte);
  const uso = plano ? linhaUso(plano, f.roteiro, premium) : null;
  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setF((p) => ({ ...p, [k]: v }));

  // Default device: first connected, else first.
  useEffect(() => {
    if (f.deviceId || !devices.length) return;
    const on = devices.find((d) => isConectado(d.ultimo_contato, Date.now()));
    const alvo = on ?? devices[0];
    if (alvo) set("deviceId", alvo.id);
  }, [devices, f.deviceId]);

  // Prefill from "Repetir com outras opções".
  useEffect(() => {
    if (!repetir) return;
    supabase.from("jobs").select("*").eq("id", repetir).maybeSingle().then(({ data }) => {
      if (!data) return;
      setF(fromOpcoes(data, data.opcoes));
      const o = (data.opcoes ?? {}) as { modelo_id?: unknown; modelo_nome?: unknown };
      setModeloSel(typeof o.modelo_id === "string" ? { id: o.modelo_id, nome: typeof o.modelo_nome === "string" ? o.modelo_nome : "" } : null);
    });
  }, [repetir]);

  function aplicarModelo(opcoes: unknown, origem: { id: string; nome: string } | null = null) {
    setModeloSel(origem);
    setF((cur) => ({ ...fromOpcoes({}, opcoes), deviceId: cur.deviceId }));
    const lista = (opcoes as { ajustes_modelo?: unknown } | null)?.ajustes_modelo;
    setAjustes(Array.isArray(lista) ? lista.filter((a): a is AjusteModelo => !!a && typeof (a as AjusteModelo).titulo === "string") : []);
  }

  // Prefill from "Meus modelos → Usar".
  useEffect(() => {
    if (!modelo) return;
    supabase.from("presets").select("id, nome, opcoes").eq("id", modelo).maybeSingle().then(({ data }) => {
      if (data) aplicarModelo(data.opcoes, { id: data.id, nome: data.nome });
    });
  }, [modelo]);

  // Prefill the part from the library.
  useEffect(() => {
    if (!peca) return;
    supabase.from("pecas").select("id, nome, arquivo_original_path, nome_arquivo_original, jobs(nome_peca)").eq("id", peca).maybeSingle().then(({ data }) => {
      if (data?.arquivo_original_path) { setPecaBib({ id: data.id, nome: data.nome, path: data.arquivo_original_path, nomeArquivo: nomeDownloadOriginal(data.nome_arquivo_original, data.jobs?.nome_peca) }); setArquivo(null); set("usarAberta", false); }
    });
  }, [peca]);

  const [modeloSel, setModeloSel] = useState<{ fatiador: string | null; modelo: string } | null>(null);
  const conectado = device ? isConectado(device.ultimo_contato, now) : false;
  const fatOpts = rel.fatiadores.map((x) => ({ id: x.id, label: nomeFatiador(x) }));
  const fatRel = rel.fatiadores.find((r) => r.id === f.fatiador);
  const impOpc = opcoesImpressora(fatRel?.impressoras ?? [], device ? parseEscolhidas(device.impressoras_escolhidas)[f.fatiador ?? ""] : undefined, f.impressora);
  const rotuloDe = (m: string) => (impOpc.modelos.find((g) => g.modelo === m)?.fora ? `${m} (fora das suas impressoras)` : m);
  const rotulosModelo = impOpc.modelos.map((g) => rotuloDe(g.modelo));
  const modeloAtual = (modeloSel && modeloSel.fatiador === f.fatiador ? modeloSel.modelo : null) ?? (f.impressora ? separarPerfil(f.impressora).modelo : null);
  const grupoModelo = impOpc.modelos.find((g) => g.modelo === modeloAtual);
  function escolherModelo(rotulo: string) {
    const g = impOpc.modelos.find((x) => rotuloDe(x.modelo) === rotulo);
    if (!g) return;
    setModeloSel({ fatiador: f.fatiador, modelo: g.modelo });
    const b = g.bicos.length === 1 ? g.bicos[0] : g.bicos.find((x) => x.bico === f.bico);
    setF((p) => ({ ...p, impressora: b?.perfil ?? null, bico: b && b.bico !== SEM_BICO ? b.bico : p.bico }));
  }
  const fatNome = fatRel ? nomeFatiador(fatRel) : "fatiador";
  const grupos = f.filTipo ? gruposMarca(rel, f.fatiador, f.filTipo, f.filMarca) : { perfil: [], outras: [] };
  const grupo = f.filMarca ? grupoDaMarca(f.filMarca, grupos) : null;
  const linhas = f.filTipo && f.filMarca && grupo ? linhasDaMarca(rel, f.fatiador, f.filTipo, f.filMarca, grupo) : [];
  const perfilNoFatiador = grupo === "perfil";
  const pastaPadrao = rel.pasta_saida_padrao ?? "Downloads/FatiaPro";
  const pastaFinal = pastaSaida ?? pastaPadrao;
  const filMarcaNome = f.filMarca;
  const nomeArquivo = nomeArquivoOtimizado({
    peca: arquivo && !f.usarAberta ? arquivo.name : pecaBib && !f.usarAberta ? pecaBib.nomeArquivo : null,
    impressora: f.impressora,
    bico: f.bico,
    marca: filMarcaNome,
    linha: f.filLinha,
    data: new Date(now),
  });
  // Guided order: preselect the slicer (only one, else the last one used if still reported).
  const { data: ultimoFatiador } = useQuery({
    queryKey: ["ultimo-fatiador"],
    queryFn: async () => {
      const { data } = await supabase.from("jobs").select("fatiador").not("fatiador", "is", null)
        .order("criado_em", { ascending: false }).order("id", { ascending: false }).range(0, 0);
      return data?.[0]?.fatiador ?? null;
    },
    staleTime: 60_000,
  });
  useEffect(() => {
    if (f.fatiador || !rel.fatiadores.length) return;
    const alvo = rel.fatiadores.length === 1 ? rel.fatiadores[0]!.id : rel.fatiadores.find((x) => x.id === ultimoFatiador)?.id;
    if (alvo) setF((p) => (p.fatiador ? p : { ...p, fatiador: alvo }));
  }, [rel.fatiadores, ultimoFatiador, f.fatiador]);
  // One chosen model (and nozzle) comes preselected.
  const autoImp = autoImpressora(impOpc.modelos);
  useEffect(() => {
    if (!autoImp || f.impressora || modeloSel?.fatiador === f.fatiador) return;
    setModeloSel({ fatiador: f.fatiador, modelo: autoImp.modelo });
    const perfil = autoImp.perfil;
    if (perfil) setF((p) => (p.impressora ? p : { ...p, impressora: perfil, bico: separarPerfil(perfil).bico === SEM_BICO ? p.bico : separarPerfil(perfil).bico }));
  }, [autoImp?.modelo, autoImp?.perfil, f.fatiador, f.impressora]);
  const preco = f.roteiro === "preco";
  const custoDolar = useCustoCurto(f.roteiro, f.motor, premium);
  const custoCurto = usaFatiaPro ? (uso?.texto ?? "—") : custoDolar;
  const [wizard, setWizard] = useState(false);
  const nomeCompleto = nomeArquivoCompleto({ pecaDefinida: f.usarAberta || !!arquivo || !!pecaBib, impressora: f.impressora, marca: filMarcaNome || null, linha: f.filLinha });

  function escolherArquivo(file: File | undefined) {
    if (!file) return;
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
    if (!EXTENSOES.includes(ext)) { toast.error("Use arquivos .stl, .3mf, .step ou .stp."); return; }
    if (file.size > MAX_BYTES) { toast.error("O arquivo passa de 100 MB."); return; }
    setArquivo(file);
    setPecaBib(null);
    set("usarAberta", false);
  }

  async function salvarModelo() {
    const nome = window.prompt("Nome do modelo:");
    if (!nome?.trim()) return;
    const { error } = await supabase.from("presets").insert({
      nome: nome.trim().slice(0, 80),
      opcoes: { ...toOpcoes(f, perfilNoFatiador), roteiro: f.roteiro, fatiador: f.fatiador, motor: f.motor } as Json,
    });
    if (error) { toast.error("Não foi possível salvar o modelo."); return; }
    toast.success("Modelo salvo.");
    qc.invalidateQueries({ queryKey: ["presets"] });
  }

  async function analisar() {
    const e = validar(f, !!arquivo || !!pecaBib);
    setErros(e);
    if (Object.keys(e).length) {
      toast.error("Confira os campos destacados.");
      const alvo = Object.keys(e).map(SECAO_DO_ERRO).sort((a, b) => ORDEM.indexOf(a) - ORDEM.indexOf(b))[0];
      const el = alvo ? document.getElementById(alvo) : null;
      if (el && el.offsetParent !== null) el.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    if (ponteVelha) return;
    setEnviando(true);
    setErroCriar(null);
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Sessão expirada.");
      let arquivo_path: string | null = null;
      if (arquivo && !f.usarAberta) {
        const ext = extensaoPermitida(arquivo.name);
        if (!ext) throw new Error("Extensão não suportada.");
        arquivo_path = caminhoOriginal(u.user.id, crypto.randomUUID(), ext);
        const { error: upErr } = await supabase.storage.from("pecas").upload(arquivo_path, arquivo, { upsert: false });
        if (upErr) throw upErr;
      } else if (pecaBib && !f.usarAberta) {
        arquivo_path = pecaBib.path; // reuse stored file, no re-upload
      }
      const r = await criarAnalise({
        data: {
          device_id: f.deviceId!,
          roteiro: f.roteiro!,
          fatiador: f.fatiador,
          motor: f.motor === "api" || f.motor === "assinatura" ? f.motor : "fatiapro",
          premium,
          opcoes: { ...toOpcoes(f, perfilNoFatiador), pasta_saida: pastaFinal, nome_arquivo: nomeArquivo, ajustes_modelo: ajustes as unknown as Json, ...(modeloSel ? { modelo_id: modeloSel.id, modelo_nome: modeloSel.nome } : {}) } as Record<string, unknown>,
          arquivo_path,
          nome_peca: arquivo && !f.usarAberta ? arquivo.name : pecaBib && !f.usarAberta ? pecaBib.nomeArquivo : null,
        },
      });
      if ("erro" in r) {
        const e = erroAnalise(r.codigo, r.detalhe, plano?.gratis_hoje.limite);
        setErroCriar(e);
        if (e.acao === "questionario" && r.job_pendente) { setPendente(r.job_pendente); setQuestJob(r.job_pendente); }
        else toast.warning(e.mensagem);
        return;
      }
      qc.invalidateQueries({ queryKey: ["meu-plano"] });
      const data = { id: r.job_id };
      navigate({ to: "/app/analise/$id", params: { id: data.id } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível criar a análise.");
    } finally {
      setEnviando(false);
    }
  }

  const roteiroInfo = ROTEIROS.find((r) => r.id === f.roteiro)?.label ?? "—";
  const fatLabel = f.fatiador ? fatiadorLabel(f.fatiador, rel) : null;
  const maquina = f.impressora ? maquinaResumo(f.impressora, fatLabel ?? "", f.bico) : "—";
  const material: ReactNode = f.filMarca && f.filLinha
    ? <>{materialTexto(f.filMarca, f.filLinha)}{!perfilNoFatiador && <span className="ml-1.5 inline-flex rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">perfil genérico</span>}</>
    : f.filTipo ?? "—";
  const s1ok = !!f.roteiro;
  const s2ok = f.usarAberta || !!arquivo || !!pecaBib;
  const s3ok = !!f.fatiador && !!f.impressora && !!f.filTipo;
  const s4ok = f.finalidades.length > 0 || f.prioridades.length > 0;

  const resumo = (
    <div className="space-y-4">
      <p className="text-lg font-bold">Resumo</p>
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Computador</Label>
        {devices.length ? (
          <Select value={f.deviceId ?? ""} onValueChange={(v) => setF((p) => ({ ...p, deviceId: v, fatiador: null, impressora: null, motor: null }))}>
            <SelectTrigger aria-label="Computador"><div className="flex min-w-0 items-center gap-2"><Dot on={conectado} /><SelectValue className="min-w-0 truncate" placeholder="Escolha o computador" /></div></SelectTrigger>
            <SelectContent>{devices.map((d) => <SelectItem key={d.id} value={d.id}>{d.nome}</SelectItem>)}</SelectContent>
          </Select>
        ) : <p className="text-sm text-muted-foreground">Nenhum computador</p>}
        {erros.device && <p className="text-xs font-medium text-destructive-ink" role="alert">{erros.device}</p>}
      </div>
      <dl className="space-y-2 text-sm">
        {([["Roteiro", roteiroInfo], ["Máquina", maquina], ["Fatiador:", fatLabel ?? "—"], ["Material", material]] as [string, ReactNode][]).map(([k, v]) => (
          <div key={k} className="flex justify-between gap-3"><dt className="text-muted-foreground">{k}</dt><dd className="min-w-0 text-right font-medium">{v}</dd></div>
        ))}
      </dl>
      {isAdmin && (
        <div className="space-y-2" id="sec-motor">
          <p id="claude-choice-label" className="text-xs text-muted-foreground">Como usar a FatiaProAI</p>
          <MotorChoice aria-labelledby="claude-choice-label" options={motoresOk} value={f.motor} roteiro={f.roteiro} premium={premium} onChange={(v) => set("motor", v)} />
          {device && !rel.motores.api && <Button size="sm" variant="link" className="h-auto p-0" onClick={() => setWizard(true)}>Configurar a chave de API</Button>}
        </div>
      )}
      {premiumPossivel && (
        <label className="flex items-start justify-between gap-3 rounded-2xl border p-3">
          <span className="min-w-0">
            <span className="block text-sm font-semibold">Análise Premium</span>
            <span className="block text-xs text-muted-foreground">{premiumTravado ? "Disponível com créditos" : "Análise mais caprichada · usa 2 créditos"}</span>
          </span>
          <Switch aria-label="Análise Premium" checked={premium} disabled={premiumTravado} onCheckedChange={setPremiumOn} />
        </label>
      )}
      <section aria-label="Arquivo otimizado" className="space-y-1.5 rounded-2xl bg-card p-3 text-sm shadow-sm">
        <p className="text-xs font-semibold text-muted-foreground">Arquivo otimizado</p>
        <p className="break-all font-mono text-xs">{pastaFinal}</p>
        {nomeCompleto
          ? <p className="break-all font-mono text-xs font-semibold">{nomeArquivo}</p>
          : <p className="text-xs text-muted-foreground">Escolha a peça, a impressora e o filamento para ver o nome do arquivo.</p>}
        {device && (
          <EnviarComando deviceId={device.id} tipo="escolher_pasta" parametros={{ padrao: false }} conectado={conectado} variant="link"
            onConcluido={(r) => { if (typeof r["pasta"] === "string" && r["pasta"]) setPastaSaida(r["pasta"]); }}>
            trocar pasta
          </EnviarComando>
        )}
      </section>
      {usaFatiaPro ? (
        <div className="rounded-2xl bg-gradient-to-br from-primary/12 to-primary/4 p-4" aria-live="polite">
          <p className="text-xs font-semibold text-muted-foreground">Uso</p>
          <p className="text-sm font-bold">{uso?.texto ?? "…"}</p>
          {uso?.verPlanos && <Link to="/app/plano" className="text-xs font-semibold text-primary-ink underline">Ver planos</Link>}
        </div>
      ) : <CostCard roteiro={f.roteiro} motor={f.motor} premium={premium} />}
      {ponteVelha && <p className="rounded-2xl bg-primary/10 p-3 text-xs text-primary-ink" role="status">Atualizando a ponte… a análise fica disponível em instantes</p>}
      {erroCriar && <ErroAnaliseAviso erro={erroCriar} onQuestionario={() => setQuestJob(pendente)} />}
      <Button size="lg" className="w-full" onClick={analisar} disabled={enviando || ponteVelha}>{enviando ? "Enviando…" : <>Analisar peça <ArrowRight className="size-4" /></>}</Button>
      <Button variant="ghost" size="sm" className="w-full" onClick={salvarModelo}><BookmarkPlus className="size-4" />Salvar como modelo</Button>
      <p className="flex items-center justify-center gap-1.5 text-xs font-medium text-muted-foreground"><ShieldCheck className="size-4 text-success" aria-hidden />Nada é enviado para a impressora</p>
    </div>
  );

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        titulo="Nova análise"
        subtitulo="Escolha o que você quer e o seu computador faz o resto."
        acao={
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button type="button" className="glass inline-flex min-h-11 items-center gap-2 rounded-full px-4 text-sm font-semibold"><Bookmark className="size-4 text-primary-ink" aria-hidden />Usar um modelo<ChevronDown className="size-4" aria-hidden /></button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {presets.length === 0 ? <DropdownMenuItem disabled>Nenhum modelo salvo</DropdownMenuItem> : presets.map((p) => (
                <DropdownMenuItem key={p.id} onClick={() => aplicarModelo(p.opcoes, { id: p.id, nome: p.nome })}>{p.nome}</DropdownMenuItem>
              ))}
              <DropdownMenuItem asChild><Link to="/app/modelos">Abrir Meus modelos</Link></DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        }
      />

      {plano && (
        <Link to="/app/plano" className="glass inline-flex min-h-9 items-center gap-2 rounded-full px-3 text-xs font-semibold">
          <Wallet className="size-4 text-primary-ink" aria-hidden />
          {plano.saldo > 0 || !plano.teste?.ativo ? `${plano.saldo} ${plano.saldo === 1 ? "crédito" : "créditos"}` : `Teste grátis · dia ${plano.teste.dia_atual} de ${DIAS_TESTE}`}
        </Link>
      )}

      {device && !conectado && (
        <p className="flex items-start gap-2 rounded-2xl bg-warning/15 p-4 text-sm text-warning-ink">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
          O computador está desconectado agora. Você pode criar o pedido: ele fica na fila e roda quando o computador voltar.
        </p>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-5">
          <Secao id="sec-1" n={1} ok={s1ok} titulo="O que você quer fazer" subtitulo="Escolha um roteiro.">
            <div role="radiogroup" aria-label="Roteiro" className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {ROTEIRO_CARDS.map((r) => {
                const on = f.roteiro === r.id;
                return (
                  <button key={r.id} type="button" role="radio" aria-checked={on} onClick={() => set("roteiro", r.id)}
                    className={cn("lift relative flex items-start gap-3 rounded-2xl border-2 p-4 text-left",
                      on ? "border-primary bg-primary/8 shadow-aqua" : "border-border bg-card shadow-sm")}>
                    <IconTile tone={r.tone}><r.icon /></IconTile>
                    <span className="min-w-0 pr-5"><span className="block font-semibold">{r.titulo}</span><span className="block text-xs text-muted-foreground">{r.linha}</span></span>
                    {on && <CheckCircle2 className="absolute right-3 top-3 size-5 text-primary-ink" aria-hidden />}
                  </button>
                );
              })}
            </div>
            {erros.roteiro && <Erro>{erros.roteiro}</Erro>}
            {ajustes.length > 0 && (
              <div className="space-y-2 pt-2">
                <p className="text-sm font-semibold">Mudanças deste modelo</p>
                <ul className="flex flex-wrap gap-2">
                  {ajustes.map((a) => (
                    <li key={a.titulo} className="inline-flex items-center gap-1 rounded-full border bg-secondary py-1 pl-3 pr-1 text-sm shadow-sm">
                      {a.titulo}
                      <button type="button" aria-label={`Remover ${a.titulo}`} className="flex size-8 items-center justify-center rounded-full hover:bg-muted" onClick={() => setAjustes((l) => l.filter((x) => x !== a))}><X className="size-3.5" /></button>
                    </li>
                  ))}
                </ul>
                <p className="text-xs text-muted-foreground">O computador aplica essas mudanças primeiro e depois analisa o que mais dá para melhorar.</p>
              </div>
            )}
          </Secao>

          <Secao id="sec-2" n={2} ok={s2ok} titulo={`Peça${preco ? " (opcional)" : ""}`} subtitulo=".stl, .3mf, .step ou .stp · até 100 MB">
            {arquivo || pecaBib ? (
              <div className="flex items-center gap-3 rounded-2xl bg-primary/7 p-3">
                <span className="flex size-14 shrink-0 items-center justify-center rounded-xl bg-card shadow-sm"><FileBox className="size-7 text-primary-ink" aria-hidden /></span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{arquivo ? arquivo.name : pecaBib!.nome}</span>
                  <span className="block text-xs text-muted-foreground">{arquivo ? `${(arquivo.size / 1048576).toFixed(1)} MB` : "da biblioteca"}</span>
                </span>
                <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>Trocar</Button>
              </div>
            ) : (
              <button type="button" onClick={() => fileRef.current?.click()} onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => { e.preventDefault(); escolherArquivo(e.dataTransfer.files[0]); }}
                className={cn("flex w-full flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-primary/40 bg-primary/7 p-8 text-center transition-colors hover:border-primary", f.usarAberta && "opacity-60")}>
                <Upload className="size-7 text-primary-ink" aria-hidden />
                <span className="text-sm font-medium">Arraste o arquivo aqui ou clique para escolher</span>
              </button>
            )}
            <input ref={fileRef} type="file" accept=".stl,.3mf,.step,.stp" className="hidden" onChange={(e) => escolherArquivo(e.target.files?.[0])} />
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" aria-pressed={f.usarAberta} className={cn(f.usarAberta && "border-primary text-primary-ink")} onClick={() => { set("usarAberta", !f.usarAberta); setArquivo(null); setPecaBib(null); }}>
                {f.usarAberta && <CheckCircle2 className="size-4" />}Usar a peça aberta no fatiador
              </Button>
              <BibliotecaPicker selected={!!pecaBib} onPick={(p) => { setPecaBib(p); setArquivo(null); set("usarAberta", false); }} />
            </div>
            {erros.peca && <Erro>{erros.peca}</Erro>}
          </Secao>

          <Secao id="sec-3" n={3} ok={s3ok} titulo="Impressora e material" subtitulo="Só aparece o que foi encontrado no seu computador.">
            <div className="space-y-1.5">
              <Label>Fatiador{preco ? " (opcional)" : ""}</Label>
              {fatOpts.length === 0 ? (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-dashed p-4">
                  <p className="text-sm text-muted-foreground">Conecte um computador para escolher o fatiador</p>
                  <Button asChild size="sm" variant="outline"><Link to="/app/configuracoes">Configurações</Link></Button>
                </div>
              ) : (
                <Segmented label="Fatiador" className={cn(!f.fatiador && "animate-destaque-azul")} options={fatOpts} value={f.fatiador} onChange={(v) => setF((p) => ({ ...p, fatiador: v, impressora: null, filMarca: null, filLinha: null }))} />
              )}
              {erros.fatiador && <Erro>{erros.fatiador}</Erro>}
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-[minmax(0,1fr)_auto]">
              <div className="space-y-1.5">
                <Label>Impressora</Label>
                <Combobox label="Impressora" options={rotulosModelo} value={modeloAtual ? rotuloDe(modeloAtual) : null} onChange={escolherModelo}
                  placeholder={f.fatiador ? (impOpc.modelos.length ? "Escolha a impressora" : "Nenhuma impressora encontrada") : "Escolha o fatiador acima"} disabled={!impOpc.modelos.length} />
                {f.fatiador && !impOpc.filtrado && impOpc.modelos.length > 0 && device && (
                  <Link to="/app/configuracoes" hash={`imp-${device.id}`} className="text-xs font-medium text-primary underline-offset-2 hover:underline">Escolher minhas impressoras</Link>
                )}
                {erros.impressora && <Erro>{erros.impressora}</Erro>}
              </div>
              <div className="space-y-1.5">
                <Label>Bico</Label>
                {grupoModelo && !(grupoModelo.bicos.length === 1 && grupoModelo.bicos[0]!.bico === SEM_BICO) ? (
                  <Segmented label="Bico" options={grupoModelo.bicos.map((b) => ({ id: b.perfil, label: `${b.bico} mm` }))} value={f.impressora ?? ""}
                    onChange={(v) => { const b = grupoModelo.bicos.find((x) => x.perfil === v); if (b) setF((p) => ({ ...p, impressora: b.perfil, bico: b.bico })); }} />
                ) : (
                  <Segmented label="Bico" options={BICOS.map((b) => ({ id: String(b), label: `${b} mm` }))} value={String(f.bico)} onChange={(v) => set("bico", BICOS.find((b) => String(b) === v) ?? f.bico)} />
                )}
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Filamento</Label>
                <Segmented label="Tipo de filamento" options={TIPOS_FILAMENTO.map((t) => ({ id: t, label: t }))} value={f.filTipo} onChange={(t) => setF((p) => ({ ...p, filTipo: t, filMarca: null, filLinha: null }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Marca</Label>
                <Combobox label="Marca" value={f.filMarca} criarComo="marca" disabled={!f.fatiador || !f.filTipo}
                  placeholder={!f.fatiador ? "Escolha o fatiador acima" : f.filTipo ? "Escolha a marca" : "Escolha o tipo primeiro"}
                  groups={f.fatiador ? [{ options: [MARCA_GENERICA] }, { titulo: `Com perfil no ${fatNome}`, options: grupos.perfil }, { titulo: "Outras marcas", options: grupos.outras }] : []}
                  onChange={(m) => setF((p) => ({ ...p, filMarca: m, filLinha: m === MARCA_GENERICA ? p.filTipo : null }))} />
                {f.filMarca && grupo === "perfil" && <p className="text-xs font-medium text-success-ink">Perfil encontrado no {fatNome}.</p>}
                {f.filMarca && grupo === "outras" && (
                  <div className="space-y-2 rounded-xl bg-primary/10 p-3">
                    <p className="text-xs text-primary-ink">O {fatNome} não tem perfil desta marca. Vamos usar o perfil {f.filTipo} genérico. Se quiser, informe as temperaturas do rótulo do rolo:</p>
                    <div className="grid grid-cols-2 gap-2">
                      <TempCampo label="Bico °C" value={f.tempBico} erro={erros.tempBico} onChange={(v) => set("tempBico", v)} />
                      <TempCampo label="Mesa °C" value={f.tempMesa} erro={erros.tempMesa} onChange={(v) => set("tempMesa", v)} />
                    </div>
                  </div>
                )}
                {f.filMarca && (
                  <>
                    <Label className="pt-1">Linha</Label>
                    <Combobox label="Linha" options={linhas} value={f.filLinha} placeholder="Escolha a linha" criarComo={grupo === "outras" ? "linha" : undefined} onChange={(l) => set("filLinha", l)} />
                  </>
                )}
              </div>
            </div>
            {erros.filamento && <Erro>{erros.filamento}</Erro>}
          </Secao>

          {(f.roteiro === "checklist" || preco) && (
            <Secao id="sec-3b" n="3b" ok={false} titulo={preco ? "Dados para o preço" : "Material no rolo"} subtitulo={preco ? "Custos para calcular as sugestões." : "Para conferir se o filamento basta."}>
              {f.roteiro === "checklist" && (
                <div className="max-w-xs space-y-1.5">
                  <Label htmlFor="gramas">Gramas restantes no rolo</Label>
                  <Input id="gramas" type="number" min={0} value={f.gramasRestantes} onChange={(e) => set("gramasRestantes", e.target.value)} aria-invalid={!!erros.gramasRestantes} />
                  {erros.gramasRestantes && <Erro>{erros.gramasRestantes}</Erro>}
                </div>
              )}
              {preco && <PrecoFields v={f.preco} onChange={(p) => set("preco", p)} erros={erros} />}
            </Secao>
          )}

          <Secao id="sec-4" n={4} ok={s4ok} titulo="Objetivo" subtitulo="Ajuda o computador a escolher o que mudar.">
            <div className="space-y-1.5">
              <Label>Para que serve</Label>
              <div className="flex flex-wrap gap-2">{FINALIDADES.map((x) => <Chip key={x} selected={f.finalidades.includes(x)} onClick={() => set("finalidades", f.finalidades.includes(x) ? f.finalidades.filter((y) => y !== x) : [...f.finalidades, x])}>{x}</Chip>)}</div>
            </div>
            <div className="space-y-1.5">
              <Label>Prioridade (até 2)</Label>
              <div className="flex flex-wrap gap-2">{PRIORIDADES.map((x) => { const i = f.prioridades.indexOf(x); return <Chip key={x} selected={i >= 0} badge={i >= 0 ? i + 1 : undefined} onClick={() => set("prioridades", togglePrioridade(f.prioridades, x))}>{x}</Chip>; })}</div>
            </div>
          </Secao>
        </div>

        <aside className="glass sticky top-5 hidden self-start rounded-[22px] p-5 lg:block" aria-label="Resumo">{resumo}</aside>
      </div>

      {device && isAdmin && <ApiKeyWizard deviceId={device.id} conectado={conectado} open={wizard} onOpenChange={setWizard} />}
      <Questionario jobId={questJob} onOpenChange={(o) => { if (!o) setQuestJob(null); }} onEnviado={() => { setErroCriar(null); void analisar(); }} />

      {/* Mobile/tablet summary bar above bottom nav */}
      <Sheet>
        <div className="glass fixed inset-x-3 bottom-[84px] z-30 flex items-center gap-3 rounded-[22px] p-2 pl-4 md:bottom-4 md:left-auto md:right-4 md:w-96 lg:hidden">
          <SheetTrigger asChild>
            <button type="button" className="flex min-h-11 min-w-0 flex-1 items-center gap-1 text-left">
              <span className="min-w-0"><span className="block text-[11px] text-muted-foreground">{usaFatiaPro ? "Uso" : "Custo estimado"}</span><span className="block truncate text-sm font-bold">{custoCurto}</span></span>
              <ChevronUp className="ml-auto size-4 text-muted-foreground" aria-hidden />
            </button>
          </SheetTrigger>
          <Button onClick={analisar} disabled={enviando || ponteVelha}>{enviando ? "Enviando…" : "Analisar peça"}</Button>
        </div>
        <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto rounded-t-[22px]">
          <SheetTitle className="sr-only">Resumo</SheetTitle>
          {resumo}
        </SheetContent>
      </Sheet>
    </div>
  );
}

/** Small optional temperature field (validated on submit). */
function TempCampo({ label, value, erro, onChange }: { label: string; value: string; erro?: string | undefined; onChange: (v: string) => void }) {
  return (
    <label className="space-y-1 text-xs font-medium">
      <span>{label}</span>
      <Input inputMode="numeric" value={value} onChange={(e) => onChange(e.target.value.replace(/[^\d]/g, "").slice(0, 3))} className="h-9" aria-invalid={!!erro} />
      {erro && <span className="block text-destructive-ink" role="alert">{erro}</span>}
    </label>
  );
}
