import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Monitor, Plug } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { devicesQuery, type DeviceRow } from "@/lib/queries";
import { FATIADORES, isConectado, parseRelatorio } from "@/lib/fatia";
import { useNow } from "@/hooks/use-now";
import { useDevicesLive } from "@/hooks/use-devices-live";
import { ClaudeSection, AssinaturaTag } from "@/components/fatia/ClaudeSection";
import { EnviarComando } from "@/components/fatia/EnviarComando";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Dot, Tag } from "@/components/fatia/Chip";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/_authenticated/app/computador")({
  head: () => ({ meta: [{ title: "Seu computador — FatiaPro" }, { name: "description", content: "Conecte e gerencie a ponte FatiaPro." }] }),
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
          <h1 className="text-[30px] font-bold tracking-[-0.02em]">Seu computador</h1>
          <p className="mt-1 text-muted-foreground">A ponte FatiaPro roda no seu computador e faz as análises nos seus fatiadores.</p>
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

function DeviceCard({ d, now }: { d: DeviceRow; now: number }) {
  const qc = useQueryClient();
  const rel = parseRelatorio(d.relatorio);
  const on = isConectado(d.ultimo_contato, now);
  const [nome, setNome] = useState(d.nome);
  const [limite, setLimite] = useState(String(d.limite_gasto_usd));

  const salvar = useMutation({
    mutationFn: async (patch: { nome?: string; limite_gasto_usd?: number; revogado?: boolean }) => {
      const { error } = await supabase.from("devices").update(patch).eq("id", d.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["devices"] }),
    onError: () => toast.error("Não foi possível salvar."),
  });

  return (
    <article className="rounded-3xl border bg-card p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Dot on={on} />
          <Input
            aria-label="Nome do computador"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            onBlur={() => nome.trim() && nome !== d.nome && salvar.mutate({ nome: nome.trim().slice(0, 80) })}
            className="h-9 w-56 border-transparent px-2 font-display text-lg font-semibold hover:border-input"
          />
        </div>
        <Tag tone={on ? "success" : "muted"}>{on ? "Conectado" : "Desconectado"}</Tag>
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm md:grid-cols-3">
        <div><dt className="text-muted-foreground">Sistema</dt><dd className="font-medium">{d.sistema === "macos" ? "macOS" : "Windows"}</dd></div>
        <div><dt className="text-muted-foreground">Versão da ponte</dt><dd className="font-medium">{d.versao_ponte ?? "—"}</dd></div>
        <div><dt className="text-muted-foreground">Último contato</dt><dd className="font-medium">{d.ultimo_contato ? new Date(d.ultimo_contato).toLocaleString("pt-BR") : "—"}</dd></div>
      </dl>

      <h3 className="mt-6 text-sm font-semibold">Fatiadores</h3>
      <ul className="mt-2 flex flex-wrap gap-2">
        {FATIADORES.map((f) => {
          const found = rel.fatiadores.find((x) => x.id === f.id);
          return (
            <li key={f.id}>
              <Tag tone={found ? "success" : "muted"}>{f.label}{found ? ` · encontrado${found.versao ? ` ${found.versao}` : ""}` : " · não encontrado"}</Tag>
            </li>
          );
        })}
      </ul>

      <h3 className="mt-6 text-sm font-semibold">Motores</h3>
      <ul className="mt-2 flex flex-wrap gap-2">
        <AssinaturaTag disponivel={rel.motores.assinatura} />
        <li><Tag tone={rel.motores.api ? "success" : "muted"}>API: {rel.motores.api ? "chave configurada" : "não configurada"}</Tag></li>
      </ul>
      <p className="mt-2 text-xs text-muted-foreground">A chave de API fica guardada no próprio computador e nunca vai para a nuvem.</p>

      <ClaudeSection deviceId={d.id} usos={d.usos_claude ?? []} rel={rel} conectado={on} />

      <div className="mt-6 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold">Pasta dos arquivos otimizados</h3>
          <p className="mt-1 break-all font-mono text-sm">{rel.pasta_saida_padrao ?? "Downloads/FatiaPro"}</p>
        </div>
        <EnviarComando deviceId={d.id} tipo="escolher_pasta" parametros={{ padrao: true }} conectado={on} variant="outline">Escolher pasta</EnviarComando>
      </div>

      <div className="mt-6 flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1.5">
          <Label htmlFor={`lim-${d.id}`}>Limite de gasto por análise (US$)</Label>
          <Input
            id={`lim-${d.id}`}
            type="number" min={0} step="0.01" className="w-40"
            value={limite}
            onChange={(e) => setLimite(e.target.value)}
            onBlur={() => {
              const v = Number(limite);
              if (Number.isFinite(v) && v >= 0 && v !== Number(d.limite_gasto_usd)) salvar.mutate({ limite_gasto_usd: v });
            }}
          />
        </div>
        <AlertDialog>
          <AlertDialogTrigger asChild><Button variant="outline" className="text-destructive">Desconectar computador</Button></AlertDialogTrigger>
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
      </div>
    </article>
  );
}
