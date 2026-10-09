import { useState } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { adminFinanceiro, adminSalvarConfig } from "@/lib/admin-cobranca.functions";
import { CONFIG_CHAVES, CONFIG_LABEL, type ConfigChave, type GrupoFin } from "@/lib/admin-cobranca";
import { formatUSD } from "@/lib/fatia";
import { Segmented } from "@/components/fatia/Chip";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "./AdminFeedback";

type P = "hoje" | "7d" | "30d";
const PERIODOS: { id: P; label: string }[] = [{ id: "hoje", label: "Hoje" }, { id: "7d", label: "7 dias" }, { id: "30d", label: "30 dias" }];
const ROTEIROS: [string, string][] = [["reduzir_tempo", "Reduzir tempo"], ["config_geral", "Configuração geral"], ["checklist", "Checklist"], ["preco", "Preço"]];
const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const usd = (v: number | null) => (v == null ? "—" : formatUSD(v));

export function AdminFinanceiro() {
  const fn = useServerFn(adminFinanceiro);
  const [periodo, setPeriodo] = useState<P>("hoje");
  const q = useQuery({ queryKey: ["admin", "financeiro", periodo], queryFn: () => fn({ data: { periodo } }), placeholderData: keepPreviousData });
  const d = q.data;
  return (
    <div className="space-y-5">
      <Segmented label="Período" options={PERIODOS} value={periodo} onChange={setPeriodo} />
      {q.isError && <p role="alert" className="text-sm text-destructive-ink">{(q.error as Error).message}</p>}
      {!d ? <Skeleton className="h-40" /> : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Card titulo="Custo da IA" valor={formatUSD(d.total_usd)} extra={brl(d.total_brl)} />
            <Card titulo="Análises" valor={String(d.cliente.analises + d.admin.analises)} />
            <Card titulo="Créditos consumidos" valor={String(d.creditos_consumidos)} extra="reservas − devoluções" />
            <Card titulo="Custo médio por crédito" valor={d.custo_por_credito_brl == null ? "—" : brl(d.custo_por_credito_brl)} />
          </div>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            <Card titulo="Receita bruta" valor={brl(d.receita.bruta)} extra={`${d.receita.pedidos} pedidos aprovados`} />
            <Card titulo="Taxa estimada" valor={brl(d.receita.taxa)} extra="Pix ou cartão" />
            <Card titulo="Receita líquida" valor={brl(d.receita.liquida)} />
            <Card titulo="Custo da IA" valor={brl(d.receita.custo_ia)} />
            <Card titulo="Margem" valor={brl(d.receita.margem)} extra={d.receita.margem_pct == null ? "—" : `${d.receita.margem_pct.toFixed(1).replace(".", ",")}%`} />
          </div>
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            <Grupo titulo="Uso de clientes" g={d.cliente} />
            <Grupo titulo="Uso do administrador" g={d.admin} />
          </div>
          <section className="rounded-2xl bg-card p-4 shadow-sm">
            <p className="mb-2 text-xs font-medium text-muted-foreground">Top 10 usuários por custo</p>
            {d.top.length === 0 ? <p className="text-sm text-muted-foreground">Sem uso no período.</p> : (
              <ol className="divide-y text-sm">{d.top.map((t) => (
                <li key={t.id} className="flex justify-between gap-2 py-2"><span className="truncate">{t.email}</span><span className="shrink-0 tabular text-muted-foreground">{t.analises} análises · {formatUSD(t.custo_usd)}</span></li>
              ))}</ol>
            )}
          </section>
          <ConfigCobranca inicial={d.config} />
        </>
      )}
    </div>
  );
}

function Grupo({ titulo, g }: { titulo: string; g: GrupoFin }) {
  return (
    <section className="space-y-2 rounded-2xl bg-card p-4 text-sm shadow-sm">
      <p className="font-semibold">{titulo}</p>
      <p>{formatUSD(g.custo_usd)} · {g.analises} análises · média {usd(g.medio_usd)}</p>
      <ul className="space-y-1 text-xs text-muted-foreground">
        {ROTEIROS.map(([id, label]) => <li key={id} className="flex justify-between"><span>{label}</span><span className="tabular">{g.por_roteiro[id]?.analises ?? 0} · média {usd(g.por_roteiro[id]?.medio_usd ?? null)}</span></li>)}
      </ul>
      <p className="text-xs text-muted-foreground">Padrão {formatUSD(g.por_modelo.padrao)} · Premium {formatUSD(g.por_modelo.premium)}</p>
    </section>
  );
}

function ConfigCobranca({ inicial }: { inicial: Record<string, number> }) {
  const qc = useQueryClient();
  const salvar = useServerFn(adminSalvarConfig);
  const [v, setV] = useState<Record<ConfigChave, string>>(() => Object.fromEntries(CONFIG_CHAVES.map((k) => [k, String(inicial[k] ?? "").replace(".", ",")])) as Record<ConfigChave, string>);
  const nums = Object.fromEntries(CONFIG_CHAVES.map((k) => [k, Number(v[k].replace(",", "."))])) as Record<ConfigChave, number>;
  const invalido = CONFIG_CHAVES.find((k) => !Number.isFinite(nums[k]) || nums[k] <= 0 || ((k === "limite_diario_gratis" || k === "uso_justo_por_dia") && !Number.isInteger(nums[k])));
  const m = useMutation({
    mutationFn: () => salvar({ data: { valores: nums } }),
    onSuccess: () => { toast.success("Configurações salvas."); qc.invalidateQueries({ queryKey: ["admin"] }); },
    onError: (e) => toast.error((e as Error).message),
  });
  return (
    <section className="space-y-3 rounded-2xl bg-card p-4 shadow-sm">
      <p className="font-semibold">Configurações de cobrança</p>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {CONFIG_CHAVES.map((k) => (
          <div key={k} className="space-y-1"><Label htmlFor={`cfg-${k}`}>{CONFIG_LABEL[k]}</Label><Input id={`cfg-${k}`} inputMode="decimal" value={v[k]} aria-invalid={invalido === k} onChange={(e) => setV((p) => ({ ...p, [k]: e.target.value }))} /></div>
        ))}
      </div>
      {invalido && <p className="text-xs text-destructive-ink" role="alert">{CONFIG_LABEL[invalido]}: precisa ser maior que zero{invalido === "limite_diario_gratis" || invalido === "uso_justo_por_dia" ? " e inteiro" : ""}.</p>}
      <Button disabled={!!invalido || m.isPending} onClick={() => m.mutate()}>{m.isPending ? "Salvando…" : "Salvar"}</Button>
    </section>
  );
}
