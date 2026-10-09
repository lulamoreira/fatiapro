import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Gift, Sparkles, Wallet } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { usePlano } from "@/hooks/use-plano";
import { useRecarregarAoVoltar } from "@/hooks/use-recarregar-ao-voltar";
import { DIAS_TESTE, ORIGEM_LOTE, descricaoMovimento } from "@/lib/plano";
import { PageHeader } from "@/components/fatia/Chip";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { MinhasCompras, PacotesCompra, PedidoRetorno } from "@/components/fatia/Compras";
import { CupomForm } from "@/components/fatia/CupomForm";

export const Route = createFileRoute("/_authenticated/app/plano")({
  head: () => ({ meta: [{ title: "Plano e créditos — FatiaPro" }, { name: "description", content: "Seu saldo de créditos, teste grátis, extrato e pacotes." }] }),
  validateSearch: (s: Record<string, unknown>): { pedido?: string } =>
    typeof s["pedido"] === "string" && /^[0-9a-f-]{36}$/i.test(s["pedido"]) ? { pedido: s["pedido"] } : {},
  component: PlanoPage,
});

const POR_PAGINA = 20;
const data = (iso: string) => new Date(iso).toLocaleDateString("pt-BR");
const dataCurta = (iso: string) => new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });

function PlanoPage() {
  const { data: p, isLoading } = usePlano();
  const { pedido } = Route.useSearch();
  const [pagina, setPagina] = useState(0);
  useRecarregarAoVoltar(pedido);
  const { data: lotes } = useQuery({
    queryKey: ["creditos-lotes"],
    queryFn: async () => {
      const { data: d, error } = await supabase.from("creditos_lotes").select("id, origem, quantidade, restante, expira_em", { count: "exact" })
        .gt("restante", 0).order("criado_em", { ascending: false }).order("id", { ascending: false }).range(0, 99);
      if (error) throw error;
      const agora = Date.now();
      return (d ?? []).filter((l) => !l.expira_em || Date.parse(l.expira_em) > agora);
    },
  });
  const { data: extrato } = useQuery({
    queryKey: ["creditos-extrato", pagina],
    queryFn: async () => {
      const de = pagina * POR_PAGINA;
      const { data: d, count, error } = await supabase.from("creditos_movimentos").select("id, tipo, quantidade, motivo, criado_em, job_id, jobs(nome_peca)", { count: "exact" })
        .order("criado_em", { ascending: false }).order("id", { ascending: false }).range(de, de + POR_PAGINA - 1);
      if (error) throw error;
      return { linhas: d ?? [], total: count ?? 0 };
    },
  });

  if (isLoading || !p) return <Skeleton className="mx-auto h-64 max-w-4xl rounded-3xl" />;
  const t = p.teste?.ativo ? p.teste : null;
  const c = p.cortesia;
  const paginas = Math.max(1, Math.ceil((extrato?.total ?? 0) / POR_PAGINA));

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader titulo="Plano e créditos" subtitulo="Seu saldo, o teste grátis e o extrato." />
      {pedido && <PedidoRetorno id={pedido} />}

      <section aria-label="Situação atual" className="space-y-4 rounded-3xl border bg-card p-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold text-muted-foreground">Saldo</p>
            <p className="text-4xl font-bold tabular">{p.saldo} <span className="text-lg font-semibold text-muted-foreground">{p.saldo === 1 ? "crédito" : "créditos"}</span></p>
            {p.proximo_vencimento && <p className="text-sm text-muted-foreground">{p.proximo_vencimento.quantidade} {p.proximo_vencimento.quantidade === 1 ? "crédito vence" : "créditos vencem"} em {dataCurta(p.proximo_vencimento.expira_em)}</p>}
          </div>
          <Wallet className="size-10 text-primary-ink" aria-hidden />
        </div>
        {t && (
          <div className="space-y-2 rounded-2xl bg-primary/7 p-4">
            <p className="flex items-center gap-2 text-sm font-semibold"><Sparkles className="size-4 text-primary-ink" aria-hidden />Teste grátis · dia {t.dia_atual} de {DIAS_TESTE}</p>
            <Progress value={(t.dia_atual / DIAS_TESTE) * 100} aria-label={`Dia ${t.dia_atual} de ${DIAS_TESTE}`} />
            <p className="text-xs text-muted-foreground">1 otimização por dia · termina em {data(t.fim)}</p>
          </div>
        )}
        {c && (
          <div className="space-y-1 rounded-2xl bg-success/10 p-4">
            <p className="flex items-center gap-2 text-sm font-semibold"><Gift className="size-4 text-success-ink" aria-hidden />Cortesia</p>
            <p className="text-xs text-muted-foreground">
              {c.tipo === "uso_diario" ? `${c.usadas_hoje} de ${c.por_dia ?? 0} por dia hoje` : "Créditos de cortesia"}
              {c.fim ? ` · válida até ${data(c.fim)}` : ""}{c.premium ? " · inclui Premium" : ""}
            </p>
          </div>
        )}
        <p className="text-xs text-muted-foreground">1 crédito = 1 otimização (Reduzir tempo ou Configuração geral). Premium usa 2. Checklist e Preço de venda são grátis. Se a análise falhar por erro do sistema, o crédito volta sozinho.</p>
      </section>

      <section aria-labelledby="lotes-t" className="space-y-3 rounded-3xl border bg-card p-6">
        <h2 id="lotes-t" className="text-lg font-semibold">Seus créditos</h2>
        {!lotes?.length ? <p className="text-sm text-muted-foreground">Nenhum crédito válido.</p> : (
          <ul className="divide-y">
            {lotes.map((l) => (
              <li key={l.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
                <span className="font-medium">{ORIGEM_LOTE[l.origem] ?? l.origem}</span>
                <span className="text-muted-foreground">{l.restante} de {l.quantidade} · {l.expira_em ? `vale até ${data(l.expira_em)}` : "sem validade"}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="extrato-t" className="space-y-3 rounded-3xl border bg-card p-6">
        <h2 id="extrato-t" className="text-lg font-semibold">Extrato</h2>
        {!extrato?.linhas.length ? <p className="text-sm text-muted-foreground">Nenhum movimento ainda.</p> : (
          <ul className="divide-y">
            {extrato.linhas.map((m) => {
              const desc = descricaoMovimento(m.tipo, m.jobs?.nome_peca, m.motivo);
              return (
                <li key={m.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                  <span className="min-w-0">
                    <span className="block text-xs text-muted-foreground">{data(m.criado_em)}</span>
                    {m.tipo === "reserva" && m.job_id
                      ? <Link to="/app/analise/$id" params={{ id: m.job_id }} className="block truncate font-medium text-primary-ink hover:underline">{desc}</Link>
                      : <span className="block truncate font-medium">{desc}</span>}
                  </span>
                  <span className={cn("shrink-0 font-semibold tabular", m.quantidade >= 0 ? "text-success-ink" : "text-foreground")}>{m.quantidade > 0 ? `+${m.quantidade}` : `−${Math.abs(m.quantidade)}`}</span>
                </li>
              );
            })}
          </ul>
        )}
        {paginas > 1 && (
          <div className="flex items-center justify-between pt-2">
            <Button size="sm" variant="outline" disabled={pagina === 0} onClick={() => setPagina((x) => x - 1)}>Anterior</Button>
            <span className="text-xs text-muted-foreground">Página {pagina + 1} de {paginas}</span>
            <Button size="sm" variant="outline" disabled={pagina + 1 >= paginas} onClick={() => setPagina((x) => x + 1)}>Próxima</Button>
          </div>
        )}
      </section>

      <PacotesCompra />
      <p className="-mt-3 text-center text-xs text-muted-foreground">Ao comprar, você concorda com os <Link to="/termos" target="_blank" rel="noopener noreferrer" className="font-medium text-primary-ink underline">Termos de uso</Link>.</p>
      <CupomForm />
      <MinhasCompras />
    </div>
  );
}
