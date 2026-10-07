import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { Upload, FileBox, BookmarkPlus, ChevronDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { devicesQuery, presetsQuery } from "@/lib/queries";
import {
  BICOS, FATIADORES, FINALIDADES, MARCA_GENERICA, MARCA_OUTRA, MOTORES, PRIORIDADES, ROTEIROS, TIPOS_FILAMENTO,
  isConectado, linhasPara, nomeArquivoOtimizado, marcasPara, parseRelatorio, togglePrioridade,
} from "@/lib/fatia";
import { useNow } from "@/hooks/use-now";
import { useDevicesLive } from "@/hooks/use-devices-live";
import { EnviarComando } from "@/components/fatia/EnviarComando";
import { AlertTriangle } from "lucide-react";
import { Chip, ChipGroup, Dot } from "@/components/fatia/Chip";
import { CostCard } from "@/components/fatia/CostCard";
import { PrecoFields } from "@/components/fatia/PrecoFields";
import { EXTENSOES, FORM_INICIAL, MAX_BYTES, fromOpcoes, toOpcoes, validar, type Erros, type FormState } from "@/components/fatia/form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/app/nova-analise")({
  validateSearch: z.object({ repetir: z.string().uuid().optional().catch(undefined) }),
  head: () => ({ meta: [{ title: "Nova análise — FatiaPro" }, { name: "description", content: "Peça uma nova análise de fatiamento ao seu computador." }] }),
  component: NovaAnalise,
});

function Campo({ titulo, erro, children }: { titulo: string; erro?: string | undefined; children: ReactNode }) {
  return (
    <fieldset className="space-y-2.5">
      <legend className="mb-2.5 text-sm font-semibold">{titulo}</legend>
      {children}
      {erro && <p className="text-xs font-medium text-destructive" role="alert">{erro}</p>}
    </fieldset>
  );
}

function NovaAnalise() {
  const { repetir } = Route.useSearch();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const now = useNow(5000);
  useDevicesLive();
  /** null = use the computer's default folder. */
  const [pastaSaida, setPastaSaida] = useState<string | null>(null);
  const { data: devices = [] } = useQuery(devicesQuery);
  const { data: presets = [] } = useQuery(presetsQuery);
  const [f, setF] = useState<FormState>(FORM_INICIAL);
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [erros, setErros] = useState<Erros>({});
  const [enviando, setEnviando] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
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
      if (data) setF(fromOpcoes(data, data.opcoes));
    });
  }, [repetir]);

  const device = devices.find((d) => d.id === f.deviceId);
  const rel = useMemo(() => parseRelatorio(device?.relatorio), [device?.relatorio]);
  const conectado = device ? isConectado(device.ultimo_contato, now) : false;
  const fatOpts = FATIADORES.filter((x) => rel.fatiadores.some((r) => r.id === x.id));
  const fatRel = rel.fatiadores.find((r) => r.id === f.fatiador);
  const impressoras = fatRel?.impressoras ?? [];
  const marcas = f.filTipo ? marcasPara(fatRel, f.filTipo) : [];
  const linhas = f.filTipo && f.filMarca ? linhasPara(fatRel, f.filTipo, f.filMarca) : [];
  const motoresOk = MOTORES.filter((m) => rel.motores[m.id]);
  const pastaPadrao = rel.pasta_saida_padrao ?? "Downloads/FatiaPro";
  const pastaFinal = pastaSaida ?? pastaPadrao;
  const filMarcaNome = f.filMarca === MARCA_OUTRA ? f.filMarcaOutra : f.filMarca;
  const nomeArquivo = nomeArquivoOtimizado({
    peca: arquivo && !f.usarAberta ? arquivo.name : null,
    impressora: f.impressora,
    bico: f.bico,
    marca: filMarcaNome,
    linha: f.filLinha,
    data: new Date(now),
  });
  const perfilEncontrado = !!(f.filTipo && f.filMarca && f.filMarca !== MARCA_GENERICA && f.filMarca !== MARCA_OUTRA && fatRel?.filamentos[f.filTipo]?.[f.filMarca]?.length);
  const preco = f.roteiro === "preco";

  function escolherArquivo(file: File | undefined) {
    if (!file) return;
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
    if (!EXTENSOES.includes(ext)) { toast.error("Use arquivos .stl, .3mf, .step ou .stp."); return; }
    if (file.size > MAX_BYTES) { toast.error("O arquivo passa de 100 MB."); return; }
    setArquivo(file);
    set("usarAberta", false);
  }

  async function salvarModelo() {
    const nome = window.prompt("Nome do modelo:");
    if (!nome?.trim()) return;
    const { error } = await supabase.from("presets").insert({
      nome: nome.trim().slice(0, 80),
      opcoes: { ...toOpcoes(f), roteiro: f.roteiro, fatiador: f.fatiador, motor: f.motor } as Json,
    });
    if (error) { toast.error("Não foi possível salvar o modelo."); return; }
    toast.success("Modelo salvo.");
    qc.invalidateQueries({ queryKey: ["presets"] });
  }

  async function analisar() {
    const e = validar(f, !!arquivo);
    setErros(e);
    if (Object.keys(e).length) { toast.error("Confira os campos destacados."); return; }
    setEnviando(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Sessão expirada.");
      let arquivo_path: string | null = null;
      if (arquivo && !f.usarAberta) {
        const safeName = arquivo.name.replace(/[^\w.\-]+/g, "_").slice(-120);
        arquivo_path = `${u.user.id}/${crypto.randomUUID()}/${safeName}`;
        const { error: upErr } = await supabase.storage.from("pecas").upload(arquivo_path, arquivo, { upsert: false });
        if (upErr) throw upErr;
      }
      const { data, error } = await supabase
        .from("jobs")
        .insert({
          device_id: f.deviceId,
          roteiro: f.roteiro!,
          fatiador: f.fatiador,
          motor: f.motor!,
          opcoes: { ...toOpcoes(f), pasta_saida: pastaFinal, nome_arquivo: nomeArquivo } as Json,
          arquivo_path,
          nome_peca: arquivo && !f.usarAberta ? arquivo.name : null,
        })
        .select("id")
        .single();
      if (error) throw error;
      navigate({ to: "/app/analise/$id", params: { id: data.id } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível criar a análise.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-card p-3">
        <div className="flex min-w-0 items-center gap-3">
          <Dot on={conectado} />
          {devices.length ? (
            <Select value={f.deviceId ?? ""} onValueChange={(v) => setF((p) => ({ ...p, deviceId: v, fatiador: null, impressora: null, motor: null }))}>
              <SelectTrigger className="w-64" aria-label="Computador"><SelectValue placeholder="Escolha o computador" /></SelectTrigger>
              <SelectContent>{devices.map((d) => <SelectItem key={d.id} value={d.id}>{d.nome}</SelectItem>)}</SelectContent>
            </Select>
          ) : (
            <span className="text-sm text-muted-foreground">Nenhum computador</span>
          )}
          <span className={cn("text-sm font-medium", conectado ? "text-success" : "text-muted-foreground")}>{conectado ? "conectado" : "desconectado"}</span>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild><Button variant="ghost" size="sm">Meus modelos <ChevronDown className="size-4" /></Button></DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {presets.length === 0 ? <DropdownMenuItem disabled>Nenhum modelo salvo</DropdownMenuItem> : presets.map((p) => (
              <DropdownMenuItem key={p.id} onClick={() => setF((cur) => ({ ...fromOpcoes({}, p.opcoes), deviceId: cur.deviceId }))}>{p.nome}</DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      {erros.device && <p className="-mt-6 text-xs font-medium text-destructive">{erros.device}</p>}

      <div>
        <h1 className="text-3xl font-bold">Nova análise</h1>
        <p className="mt-1 text-muted-foreground">Escolha o que você quer e o seu computador faz o resto.</p>
      </div>

      {device && !conectado && (
        <p className="-mt-4 flex items-start gap-2 rounded-2xl bg-warning/25 p-4 text-sm text-warning-foreground dark:text-warning">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
          Seu computador está desconectado agora. Você pode criar o pedido: ele fica na fila e roda quando o computador voltar.
        </p>
      )}

      <Campo titulo="Roteiro" erro={erros.roteiro}>
        <ChipGroup label="Roteiro" options={ROTEIROS} value={f.roteiro} onChange={(v) => set("roteiro", v)} />
      </Campo>

      <Campo titulo={`Fatiador${preco ? " (opcional)" : ""}`} erro={erros.fatiador}>
        {fatOpts.length === 0 ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-dashed p-4">
            <p className="text-sm text-muted-foreground">Conecte um computador para escolher o fatiador</p>
            <Button asChild size="sm" variant="outline"><Link to="/app/computador">Seu computador</Link></Button>
          </div>
        ) : (
          <ChipGroup label="Fatiador" options={fatOpts} value={f.fatiador} onChange={(v) => setF((p) => ({ ...p, fatiador: v, impressora: null, filMarca: null, filLinha: null }))} />
        )}
      </Campo>

      <Campo titulo={`Peça${preco ? " (opcional)" : ""}`} erro={erros.peca}>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_auto]">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); escolherArquivo(e.dataTransfer.files[0]); }}
            className={cn("flex items-center gap-3 rounded-2xl border-2 border-dashed p-5 text-left transition-colors hover:border-primary/60 hover:bg-accent/40", arquivo && "border-primary bg-accent/40")}
          >
            {arquivo ? <FileBox className="size-6 text-primary" aria-hidden /> : <Upload className="size-6 text-muted-foreground" aria-hidden />}
            <span className="text-sm">{arquivo ? <><b>{arquivo.name}</b> · {(arquivo.size / 1048576).toFixed(1)} MB</> : "Arraste o arquivo aqui ou clique (.stl, .3mf, .step, .stp · até 100 MB)"}</span>
          </button>
          <input ref={fileRef} type="file" accept=".stl,.3mf,.step,.stp" className="hidden" onChange={(e) => escolherArquivo(e.target.files?.[0])} />
          <Chip className="self-center" selected={f.usarAberta} onClick={() => { set("usarAberta", !f.usarAberta); setArquivo(null); }}>Usar a peça aberta no fatiador</Chip>
        </div>
      </Campo>

      <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
        <Campo titulo="Impressora" erro={erros.impressora}>
          {impressoras.length ? (
            <Select value={f.impressora ?? ""} onValueChange={(v) => set("impressora", v)}>
              <SelectTrigger aria-label="Impressora"><SelectValue placeholder="Escolha a impressora" /></SelectTrigger>
              <SelectContent>{impressoras.map((i) => <SelectItem key={i} value={i}>{i}</SelectItem>)}</SelectContent>
            </Select>
          ) : <p className="text-sm text-muted-foreground">{f.fatiador ? "Nenhuma impressora encontrada neste fatiador." : "Escolha o fatiador primeiro."}</p>}
        </Campo>
        <Campo titulo="Bico">
          <div className="flex flex-wrap gap-2">{BICOS.map((b) => <Chip key={b} selected={f.bico === b} onClick={() => set("bico", b)}>{b} mm</Chip>)}</div>
        </Campo>
      </div>

      <Campo titulo="Filamento" erro={erros.filamento}>
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">{TIPOS_FILAMENTO.map((t) => <Chip key={t} selected={f.filTipo === t} onClick={() => setF((p) => ({ ...p, filTipo: t, filMarca: null, filLinha: null }))}>{t}</Chip>)}</div>
          {f.filTipo && <div className="flex flex-wrap gap-2 border-l-2 pl-3">{marcas.map((m) => <Chip key={m} selected={f.filMarca === m} onClick={() => setF((p) => ({ ...p, filMarca: m, filLinha: m === MARCA_GENERICA || m === MARCA_OUTRA ? p.filTipo : null }))}>{m}</Chip>)}</div>}
          {f.filMarca === MARCA_OUTRA && <Input className="max-w-xs" placeholder="Qual marca?" value={f.filMarcaOutra} onChange={(e) => set("filMarcaOutra", e.target.value)} maxLength={60} />}
          {f.filMarca && <div className="flex flex-wrap gap-2 border-l-2 pl-6">{linhas.map((l) => <Chip key={l} selected={f.filLinha === l} onClick={() => set("filLinha", l)}>{l}</Chip>)}</div>}
          {f.filMarca && <p className={cn("text-xs", perfilEncontrado ? "text-success" : "text-muted-foreground")}>{perfilEncontrado ? "Perfil encontrado no fatiador." : "Vai usar o perfil Genérico."}</p>}
        </div>
      </Campo>

      <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
        <Campo titulo="Para que serve">
          <div className="flex flex-wrap gap-2">{FINALIDADES.map((x) => <Chip key={x} selected={f.finalidades.includes(x)} onClick={() => set("finalidades", f.finalidades.includes(x) ? f.finalidades.filter((y) => y !== x) : [...f.finalidades, x])}>{x}</Chip>)}</div>
        </Campo>
        <Campo titulo="Prioridade (até 2)">
          <div className="flex flex-wrap gap-2">{PRIORIDADES.map((x) => { const i = f.prioridades.indexOf(x); return <Chip key={x} selected={i >= 0} badge={i >= 0 ? `${i + 1}º` : undefined} onClick={() => set("prioridades", togglePrioridade(f.prioridades, x))}>{x}</Chip>; })}</div>
        </Campo>
      </div>

      {f.roteiro === "checklist" && (
        <div className="max-w-xs space-y-1.5">
          <Label htmlFor="gramas">Gramas restantes no rolo</Label>
          <Input id="gramas" type="number" min={0} value={f.gramasRestantes} onChange={(e) => set("gramasRestantes", e.target.value)} aria-invalid={!!erros.gramasRestantes} />
          {erros.gramasRestantes && <p className="text-xs text-destructive">{erros.gramasRestantes}</p>}
        </div>
      )}
      {preco && <Campo titulo="Dados para o preço"><PrecoFields v={f.preco} onChange={(p) => set("preco", p)} erros={erros} /></Campo>}

      <Campo titulo="Motor" erro={erros.motor}>
        {motoresOk.length ? <ChipGroup label="Motor" options={motoresOk} value={f.motor} onChange={(v) => set("motor", v)} /> : (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-dashed p-4">
            <p className="text-sm text-muted-foreground">Nenhum motor pronto neste computador.</p>
            <Button asChild size="sm" variant="outline"><Link to="/app/computador" {...(device ? { hash: `claude-${device.id}` } : {})}>Configurar o Claude</Link></Button>
          </div>
        )}
      </Campo>

      <CostCard roteiro={f.roteiro} motor={f.motor} />

      <section aria-label="Arquivo otimizado" className="rounded-2xl border bg-card p-5">
        <p className="text-sm font-semibold">Arquivo otimizado</p>
        <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
          <p className="min-w-0 text-sm">
            Salvar em: <span className="break-all font-mono">{pastaFinal}</span>
          </p>
          {device && (
            <EnviarComando
              deviceId={device.id}
              tipo="escolher_pasta"
              parametros={{ padrao: false }}
              conectado={conectado}
              variant="link"
              onConcluido={(r) => { if (typeof r["pasta"] === "string" && r["pasta"]) setPastaSaida(r["pasta"]); }}
            >
              Trocar só desta vez
            </EnviarComando>
          )}
        </div>
        <p className="mt-3 text-sm">Nome do arquivo:</p>
        <p className="mt-1 break-all font-mono text-sm font-medium">{nomeArquivo}</p>
      </section>

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Button variant="outline" size="lg" onClick={salvarModelo}><BookmarkPlus className="size-4" />Salvar como modelo</Button>
        <Button size="lg" onClick={analisar} disabled={enviando}>{enviando ? "Enviando…" : "Analisar peça"}</Button>
      </div>
    </div>
  );
}
