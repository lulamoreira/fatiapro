import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { CheckCircle2, Clock, PartyPopper, ShieldCheck, XCircle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { criarCompra } from "@/lib/compra.functions";
import { STATUS_PEDIDO, brlCentavos } from "@/lib/mercadopago";
import { Tag } from "@/components/fatia/Chip";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const POR_PAGINA = 10;
const POLL_MS = 3000;
const POLL_MAX_MS = 120_000;

/** Package cards. Price shown comes from the DB; the server re-reads it on purchase. */
export function PacotesCompra() {
  const comprar = useServerFn(criarCompra);
  const { data: pacotes, isLoading } = useQuery({
    queryKey: ["pacotes"],
    queryFn: async () => {
      const { data, error } = await supabase.from("pacotes").select("id, nome, creditos, preco_centavos, validade_meses, destaque", { count: "exact" })
        .eq("ativo", true).order("ordem", { ascending: true }).order("id", { ascending: true }).range(0, 49);
      if (error) throw error;
      return data ?? [];
    },
  });
  const m = useMutation({
    mutationFn: (pacote_id: string) => comprar({ data: { pacote_id } }),
    onSuccess: (r) => { window.location.href = r.url; },
    onError: (e) => toast.error((e as Error).message || "Não foi possível iniciar a compra."),
  });
  return (
    <section id="comprar" aria-labelledby="comprar-t" className="scroll-mt-24 space-y-3">
      <h2 id="comprar-t" className="text-lg font-semibold">Comprar créditos</h2>
      {isLoading ? <Skeleton className="h-40 rounded-2xl" /> : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          {(pacotes ?? []).map((k) => (
            <div key={k.id} className={cn("relative space-y-2 rounded-2xl border bg-card p-5", k.destaque && "border-2 border-primary")}>
              {k.destaque && <Tag tone="primary" className="absolute -top-3 left-4">Mais escolhido</Tag>}
              <p className="text-2xl font-bold">{k.nome}</p>
              <p className="text-lg font-semibold">{brlCentavos(k.preco_centavos)}</p>
              <p className="text-xs text-muted-foreground">Validade de {k.validade_meses} meses</p>
              <Button variant={k.destaque ? "default" : "outline"} className="w-full" disabled={m.isPending} onClick={() => m.mutate(k.id)}>
                {m.isPending && m.variables === k.id ? "Abrindo o Mercado Pago…" : "Comprar"}
              </Button>
            </div>
          ))}
        </div>
      )}
      <p className="flex items-center gap-2 text-xs text-muted-foreground"><ShieldCheck className="size-4" aria-hidden />Pix, cartão ou saldo Mercado Pago · pagamento seguro pelo Mercado Pago</p>
    </section>
  );
}

/** Status of the order the user just returned with (?pedido=ID), polled every 3 s for up to 2 min. */
export function PedidoRetorno({ id }: { id: string }) {
  const qc = useQueryClient();
  const [inicio] = useState(() => Date.now());
  const { data: p } = useQuery({
    queryKey: ["pedido", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("pedidos").select("id, status, creditos").eq("id", id).maybeSingle();
      if (error) throw error;
      return data;
    },
    refetchInterval: (q) => (q.state.data?.status === "pendente" || !q.state.data) && Date.now() - inicio < POLL_MAX_MS ? POLL_MS : false,
  });
  const aprovado = p?.status === "aprovado";
  useEffect(() => {
    if (aprovado) { qc.invalidateQueries({ queryKey: ["plano"] }); qc.invalidateQueries({ queryKey: ["creditos-lotes"] }); qc.invalidateQueries({ queryKey: ["creditos-extrato"] }); qc.invalidateQueries({ queryKey: ["minhas-compras"] }); }
  }, [aprovado, qc]);
  if (!p) return null;
  if (aprovado) return (
    <div role="status" className="flex items-center gap-3 rounded-2xl bg-success/12 p-4 text-sm font-semibold text-success-ink">
      <PartyPopper className="size-5 motion-safe:animate-bounce" aria-hidden /><CheckCircle2 className="size-5" aria-hidden />
      Pagamento aprovado — {p.creditos} créditos adicionados
    </div>
  );
  if (p.status === "pendente") return (
    <div role="status" className="flex items-center gap-3 rounded-2xl bg-primary/8 p-4 text-sm font-medium">
      <Clock className="size-5 text-primary-ink" aria-hidden />Pagamento em análise — os créditos entram assim que o Mercado Pago confirmar
    </div>
  );
  return (
    <div role="status" className="flex flex-wrap items-center gap-3 rounded-2xl bg-destructive/10 p-4 text-sm font-medium text-destructive-ink">
      <XCircle className="size-5" aria-hidden />Pagamento não aprovado —
      <Link to="/app/plano" hash="comprar" className="underline">tentar de novo</Link>
    </div>
  );
}

export function MinhasCompras() {
  const [pagina, setPagina] = useState(0);
  const { data } = useQuery({
    queryKey: ["minhas-compras", pagina],
    queryFn: async () => {
      const de = pagina * POR_PAGINA;
      const { data: d, count, error } = await supabase.from("pedidos").select("id, criado_em, valor_centavos, status, creditos, pacotes(nome)", { count: "exact" })
        .order("criado_em", { ascending: false }).order("id", { ascending: false }).range(de, de + POR_PAGINA - 1);
      if (error) throw error;
      return { linhas: d ?? [], total: count ?? 0 };
    },
  });
  const paginas = Math.max(1, Math.ceil((data?.total ?? 0) / POR_PAGINA));
  return (
    <section aria-labelledby="compras-t" className="space-y-3 rounded-3xl border bg-card p-6">
      <h2 id="compras-t" className="text-lg font-semibold">Minhas compras</h2>
      {!data?.linhas.length ? <p className="text-sm text-muted-foreground">Nenhuma compra ainda.</p> : (
        <ul className="divide-y">{data.linhas.map((c) => (
          <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
            <span><span className="block text-xs text-muted-foreground">{new Date(c.criado_em).toLocaleDateString("pt-BR")}</span><span className="font-medium">{c.pacotes?.nome ?? `${c.creditos} créditos`}</span></span>
            <span className="flex items-center gap-2"><span className="tabular">{brlCentavos(c.valor_centavos)}</span><Tag tone={c.status === "aprovado" ? "success" : c.status === "pendente" ? "primary" : "muted"}>{STATUS_PEDIDO[c.status] ?? c.status}</Tag></span>
          </li>
        ))}</ul>
      )}
      {paginas > 1 && (
        <div className="flex items-center justify-between pt-2">
          <Button size="sm" variant="outline" disabled={pagina === 0} onClick={() => setPagina((x) => x - 1)}>Anterior</Button>
          <span className="text-xs text-muted-foreground">Página {pagina + 1} de {paginas}</span>
          <Button size="sm" variant="outline" disabled={pagina + 1 >= paginas} onClick={() => setPagina((x) => x + 1)}>Próxima</Button>
        </div>
      )}
    </section>
  );
}
