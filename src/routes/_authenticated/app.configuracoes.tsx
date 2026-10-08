import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Laptop, Monitor, MoreHorizontal, Pencil, Plug } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { devicesQuery, type DeviceRow } from "@/lib/queries";
import { isConectado, nomeFatiador, parseRelatorio } from "@/lib/fatia";
import { cn } from "@/lib/utils";
import { useIsAdmin } from "@/hooks/use-is-admin";
import { AdicionarFatiadorDialog } from "@/components/fatia/AdicionarFatiadorDialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useNow } from "@/hooks/use-now";
import { useDevicesLive } from "@/hooks/use-devices-live";
import { ClaudeSection } from "@/components/fatia/ClaudeSection";
import { EnviarComando } from "@/components/fatia/EnviarComando";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Dot, IconTile, Tag } from "@/components/fatia/Chip";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/_authenticated/app/configuracoes")({
  head: () => ({ meta: [{ title: "Configurações — FatiaPro" }, { name: "description", content: "Conecte e gerencie a ponte FatiaPro." }] }),
  component: ComputadorPage,
});

function ComputadorPage() {
  const qc = useQueryClient();
  const { data: devices, isLoading } = useQuery(devicesQuery);
  const [codigo, setCodigo] = useState<{ codigo: string; expira: number } | null>(null);
  const now = useNow(1000);

  useDevicesLive();

  // Fallback polling while a pairing code is visible.
  const restante = codigo ? Math.max(0, Math.floor((codigo.expira - now) / 1000)) : 0;
  useEffect(() => {
    if (!codigo) return undefined;
    const t = setInterval(() => qc.invalidateQueries({ queryKey: ["devices"] }), 4000);
    return () => clearInterval(t);
  }, [codigo, qc]);

  const [qtdInicial, setQtdInicial] = useState<number | null>(null);
  useEffect(() => {
    if (codigo && qtdInicial !== null && devices && devices.length > qtdInicial) {
      toast.success("Computador conectado!");
      setCodigo(null);
      setQtdInicial(null);
    }
  }, [devices, codigo, qtdInicial]);

  async function gerar() {
    const { data, error } = await supabase.rpc("create_pairing_code");
    const row = Array.isArray(data) ? data[0] : null;
    if (error || !row) {
      toast.error("Não foi possível gerar o código.");
      return;
    }
    setQtdInicial(devices?.length ?? 0);
    setCodigo({ codigo: row.codigo, expira: Date.parse(row.expira_em) });
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[30px] font-bold tracking-[-0.02em]">Configurações</h1>
          <p className="mt-1 text-muted-foreground">Computadores conectados, FatiaProAI, fatiadores e pasta dos arquivos.</p>
        </div>
        <Button onClick={gerar} size="lg"><Plug className="size-4" />Conectar computador</Button>
      </div>

      {codigo && (
        <div className="rounded-3xl border-2 border-primary bg-accent p-6 text-center">
          {restante > 0 ? (
            <>
              <p className="text-sm font-medium text-accent-foreground">Abra a ponte FatiaPro no seu computador e digite este código</p>
              <p className="my-4 font-display text-5xl font-bold tracking-[0.3em] tabular md:text-6xl" aria-live="polite">{codigo.codigo}</p>
              <p className="text-sm text-muted-foreground tabular">
                Válido por {Math.floor(restante / 60)}:{String(restante % 60).padStart(2, "0")} · esta tela atualiza sozinha
              </p>
            </>
          ) : (
            <p className="text-sm">O código expirou. <button className="font-semibold text-primary-ink underline" onClick={gerar}>Gerar outro</button></p>
          )}
        </div>
      )}

      {isLoading ? (
        <Skeleton className="h-48 rounded-3xl" />
      ) : !devices?.length ? (
        <div className="rounded-3xl border border-dashed p-10 text-center">
          <Monitor className="mx-auto size-10 text-muted-foreground" aria-hidden />
          <h2 className="mt-4 text-xl font-semibold">Nenhum computador conectado</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            A ponte é um programa que você instala no seu Mac ou Windows. Ela encontra seus fatiadores, roda as análises e manda o progresso pra cá. Nada é enviado para a impressora.
          </p>
          {!codigo && <Button className="mt-6" onClick={gerar}>Conectar computador</Button>}
        </div>
      ) : (
        <div className="space-y-4">{devices.map((d) => <DeviceCard key={d.id} d={d} now={now} />)}</div>
      )}
    </div>
  );
}

const segundosDesde = (iso: string | null, now: number) => (iso ? Math.max(0, Math.round((now - Date.parse(iso)) / 1000)) : null);
function tempo(s: number | null): string {
  if (s == null) return "nunca";
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)} min`;
  if (s < 86400) return `${Math.floor(s / 3600)} h`;
  return `${Math.floor(s / 86400)} d`;
}
const pastaCurta = (p: string) => p.split(/[\\/]/).filter(Boolean).pop() ?? p;
const irPara = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });

function Quadrinho({ alvo, titulo, valor, pill }: { alvo: string; titulo: string; valor: string; pill: ReactNode }) {
  return (
    <button type="button" onClick={() => irPara(alvo)} className="lift flex min-h-11 flex-col items-start gap-1.5 rounded-2xl border bg-card p-4 text-left shadow-sm">
      <span className="text-xs font-semibold text-muted-foreground">{titulo}</span>
      <span className="w-full truncate font-semibold">{valor}</span>
      {pill}
    </button>
  );
}

function DeviceCard({ d, now }: { d: DeviceRow; now: number }) {
  const qc = useQueryClient();
  const isAdmin = useIsAdmin();
  const rel = parseRelatorio(d.relatorio);
  const on = isConectado(d.ultimo_contato, now);
  const [editando, setEditando] = useState(false);
  const [nome, setNome] = useState(d.nome);
  const [limite, setLimite] = useState(String(d.limite_gasto_usd));
  const [confirmar, setConfirmar] = useState(false);
  const pasta = rel.pasta_saida_padrao ?? "Downloads/FatiaPro";
  const sec = (s: string) => `${s}-${d.id}`;

  const salvar = useMutation({
    mutationFn: async (patch: { nome?: string; limite_gasto_usd?: number; revogado?: boolean }) => {
      const { error } = await supabase.from("devices").update(patch).eq("id", d.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["devices"] }),
    onError: () => toast.error("Não foi possível salvar."),
  });

  function salvarNome() {
    setEditando(false);
    const n = nome.trim().slice(0, 80);
    if (n && n !== d.nome) salvar.mutate({ nome: n }); else setNome(d.nome);
  }

  const claudePronto = rel.motores.api ? "Pronto (API)" : isAdmin && rel.motores.assinatura ? "Pronto (assinatura)" : null;

  return (
    <article className="space-y-6 rounded-2xl border bg-card p-5 md:p-6">
      {/* a) Header */}
      <header className="flex flex-wrap items-start gap-3">
        <IconTile tone="blue"><Laptop /></IconTile>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1">
            {editando ? (
              <Input autoFocus aria-label="Nome do computador" value={nome} maxLength={80} onChange={(e) => setNome(e.target.value)} onBlur={salvarNome}
                onKeyDown={(e) => { if (e.key === "Enter") salvarNome(); if (e.key === "Escape") { setNome(d.nome); setEditando(false); } }} className="h-10 max-w-xs text-lg font-semibold" />
            ) : (
              <>
                <h2 className="truncate text-lg font-semibold">{d.nome}</h2>
                <Button variant="ghost" size="icon" aria-label="Renomear" onClick={() => setEditando(true)}><Pencil className="size-4" /></Button>
              </>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            {d.sistema === "macos" ? "macOS" : "Windows"} · ponte {d.versao_ponte ?? "—"} · último sinal há {tempo(segundosDesde(d.ultimo_contato, now))}
          </p>
        </div>
        <span className={cn("inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold", on ? "bg-success/15 text-success-ink" : "bg-muted text-muted-foreground")}>
          <Dot on={on} />{on ? "Conectado" : "Desconectado"}
        </span>
        <DropdownMenu>
          <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" aria-label="Mais opções"><MoreHorizontal className="size-5" /></Button></DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setEditando(true)}>Renomear</DropdownMenuItem>
            <DropdownMenuItem className="text-destructive-ink" onClick={() => setConfirmar(true)}>Desconectar computador</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </header>

      {/* b) Summary tiles */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Quadrinho alvo={sec("fat")} titulo="Fatiadores" valor={`${rel.fatiadores.length} ${rel.fatiadores.length === 1 ? "pronto" : "prontos"}`}
          pill={<Tag tone={rel.fatiadores.length ? "success" : "warning"}>{rel.fatiadores.length ? "Tudo certo" : "Nenhum encontrado"}</Tag>} />
        <Quadrinho alvo={`claude-${d.id}`} titulo="FatiaProAI" valor={claudePronto ?? "Falta a chave de API"}
          pill={<Tag tone={claudePronto ? "success" : "warning"}>{claudePronto ? "Pronto" : "Configure para analisar"}</Tag>} />
        <Quadrinho alvo={sec("pasta")} titulo="Arquivos otimizados" valor={pastaCurta(pasta)} pill={<Tag tone="primary">Trocar pasta</Tag>} />
      </div>

      {/* c) Claude */}
      <ClaudeSection deviceId={d.id} rel={rel} conectado={on} />

      {/* d) Slicers */}
      <section id={sec("fat")} aria-labelledby={`${sec("fat")}-t`} className="scroll-mt-6 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 id={`${sec("fat")}-t`} className="text-[17px] font-semibold">Fatiadores</h3>
          <AdicionarFatiadorDialog deviceId={d.id} conectado={on} />
        </div>
        {rel.fatiadores.length === 0 ? (
          <p className="rounded-2xl border border-dashed p-4 text-sm text-muted-foreground">Nenhum fatiador encontrado ainda. Abra a ponte no computador ou adicione um.</p>
        ) : (
          <ul className="divide-y rounded-2xl border bg-card shadow-sm">
            {rel.fatiadores.map((f, i) => {
              const n = nomeFatiador(f);
              return (
                <li key={f.id} className="flex items-center gap-3 p-3">
                  <IconTile tone={(["blue", "green", "orange", "purple"] as const)[i % 4] ?? "blue"}><span className="text-base font-bold">{n.charAt(0).toUpperCase()}</span></IconTile>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{n}</p>
                    <p className="text-xs text-muted-foreground">versão {f.versao ?? "—"} · {f.impressoras.length} {f.impressoras.length === 1 ? "impressora" : "impressoras"}</p>
                  </div>
                  <Tag tone="success">Pronto</Tag>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* e) Output folder */}
      <section id={sec("pasta")} aria-labelledby={`${sec("pasta")}-t`} className="scroll-mt-6 space-y-2">
        <h3 id={`${sec("pasta")}-t`} className="text-[17px] font-semibold">Pasta dos arquivos otimizados</h3>
        <div className="flex flex-wrap items-start justify-between gap-3 rounded-2xl border bg-card p-4 shadow-sm">
          <p className="min-w-0 break-all font-mono text-sm">{pasta}</p>
          <EnviarComando deviceId={d.id} tipo="escolher_pasta" parametros={{ padrao: true }} conectado={on} variant="outline">Escolher pasta</EnviarComando>
        </div>
        <p className="text-xs text-muted-foreground">O nome inclui peça, impressora, bico, filamento, data e hora.</p>
      </section>

      {/* f) Limits */}
      <section aria-labelledby={`${sec("lim")}-t`} className="space-y-3">
        <h3 id={`${sec("lim")}-t`} className="text-[17px] font-semibold">Limites</h3>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="space-y-1.5">
            <Label htmlFor={`lim-${d.id}`}>Limite de gasto por análise (US$)</Label>
            <Input id={`lim-${d.id}`} type="number" min={0} step="0.01" className="w-40" value={limite} onChange={(e) => setLimite(e.target.value)}
              onBlur={() => { const v = Number(limite); if (Number.isFinite(v) && v >= 0 && v !== Number(d.limite_gasto_usd)) salvar.mutate({ limite_gasto_usd: v }); }} />
          </div>
          <Button variant="ghost" className="bg-destructive/10 text-destructive-ink hover:bg-destructive/15" onClick={() => setConfirmar(true)}>Desconectar computador</Button>
        </div>
      </section>

      <AlertDialog open={confirmar} onOpenChange={setConfirmar}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desconectar “{d.nome}”?</AlertDialogTitle>
            <AlertDialogDescription>A ponte deste computador perde o acesso. Para usar de novo será preciso conectar com um novo código.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction onClick={() => salvar.mutate({ revogado: true })}>Desconectar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </article>
  );
}
