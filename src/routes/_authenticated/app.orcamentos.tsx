import { createFileRoute, Link } from "@tanstack/react-router";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Download, FileText, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useNegocio } from "@/hooks/use-negocio";
import { baixarOrcamentoPdf } from "@/lib/orcamento-pdf";
import { brl, dataBR, numeroOrc, totalDe } from "@/lib/orcamento";
import { OrcamentoDialog } from "@/components/fatia/OrcamentoDialog";
import { NegocioPendente } from "@/components/fatia/NegocioPendente";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/app/orcamentos")({
  head: () => ({ meta: [{ title: "Orçamentos — FatiaPro" }, { name: "description", content: "Seus orçamentos em PDF, com status e taxa de aprovação." }, { property: "og:title", content: "Orçamentos — FatiaPro" }, { property: "og:description", content: "Seus orçamentos em PDF, com status e taxa de aprovação." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: OrcamentosPage,
});

const POR_PAGINA = 20;
const STATUS = [{ v: "enviado", r: "Enviado" }, { v: "aprovado", r: "Aprovado" }, { v: "recusado", r: "Recusado" }] as const;

function OrcamentosPage() {
  const qc = useQueryClient();
  const { data: negocio } = useNegocio();
  const [pagina, setPagina] = useState(0);
  const [novo, setNovo] = useState(false);
  const [aviso, setAviso] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["orcamentos", pagina],
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const de = pagina * POR_PAGINA;
      const { data: d, count, error } = await supabase.from("orcamentos").select("*", { count: "exact" })
        .order("criado_em", { ascending: false }).order("id", { ascending: false }).range(de, de + POR_PAGINA - 1);
      if (error) throw error;
      return { linhas: d ?? [], total: count ?? 0 };
    },
  });
  const { data: ind } = useQuery({
    queryKey: ["orcamentos", "indicadores"],
    queryFn: async () => {
      const c = { enviado: 0, aprovado: 0, recusado: 0, mes: 0 };
      const agora = new Date();
      const iniMes = new Date(agora.getFullYear(), agora.getMonth(), 1).getTime();
      for (let de = 0; ; de += 1000) {
        const { data: d, count, error } = await supabase.from("orcamentos").select("status, total_centavos, total_bigint, criado_em", { count: "exact" })
          .order("criado_em", { ascending: false }).order("id", { ascending: false }).range(de, de + 999);
        if (error) throw error;
        for (const o of d) {
          c[o.status as "enviado"]++;
          if (o.status === "aprovado" && Date.parse(o.criado_em) >= iniMes) c.mes += totalDe(o);
        }
        if (de + 1000 >= (count ?? 0)) break;
      }
      return c;
    },
  });
  const status = useMutation({
    mutationFn: async (v: { id: string; status: string }) => { const { error } = await supabase.from("orcamentos").update({ status: v.status }).eq("id", v.id); if (error) throw error; },
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ["orcamentos"] }); toast.success("Salvo"); },
    onError: () => toast.error("Não foi possível salvar."),
  });

  const decididos = (ind?.aprovado ?? 0) + (ind?.recusado ?? 0);
  const taxa = decididos ? Math.round(((ind?.aprovado ?? 0) / decididos) * 100) : 0;
  const paginas = Math.max(1, Math.ceil((data?.total ?? 0) / POR_PAGINA));

  async function pdf(o: NonNullable<typeof data>["linhas"][number]) {
    if (!negocio) { setAviso(true); return; }
    try { await baixarOrcamentoPdf(negocio, o); } catch { toast.error("Não foi possível gerar o PDF."); }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[30px] font-bold tracking-[-0.02em]">Orçamentos</h1>
          <p className="mt-1 text-muted-foreground">Orçamentos em PDF para seus clientes. Não gastam créditos.</p>
        </div>
        <Button size="lg" onClick={() => (negocio ? setNovo(true) : setAviso(true))}><Plus className="size-4" aria-hidden />Novo orçamento</Button>
      </div>

      <section aria-label="Indicadores" className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {[["Enviados", ind?.enviado ?? 0], ["Aprovados", ind?.aprovado ?? 0], ["Recusados", ind?.recusado ?? 0], ["Aprovação", `${taxa}%`], ["Aprovado no mês", brl(ind?.mes ?? 0)]].map(([r, v]) => (
          <div key={String(r)} className="rounded-2xl border bg-card p-4"><p className="text-xs text-muted-foreground">{r}</p><p className="text-xl font-bold tabular">{v}</p></div>
        ))}
      </section>

      {isLoading ? <Skeleton className="h-48 rounded-3xl" /> : !data?.linhas.length ? (
        <div className="rounded-3xl border border-dashed p-10 text-center">
          <FileText className="mx-auto size-10 text-muted-foreground" aria-hidden />
          <p className="mt-3 text-sm text-muted-foreground">Nenhum orçamento ainda. Gere um a partir de uma análise de Preço de venda ou clique em "Novo orçamento".</p>
        </div>
      ) : (
        <ul className="divide-y rounded-3xl border bg-card">
          {data.linhas.map((o) => (
            <li key={o.id} className="flex flex-wrap items-center gap-3 p-4 text-sm">
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{numeroOrc(o.numero)} · {o.cliente_nome}</p>
                <p className="truncate text-xs text-muted-foreground">{dataBR(new Date(o.criado_em))} · {o.descricao}{o.job_id && <> · <Link to="/app/analise/$id" params={{ id: o.job_id }} className="text-primary-ink hover:underline">ver análise</Link></>}</p>
              </div>
              <span className="font-bold tabular">{brl(totalDe(o))}</span>
              <Select value={o.status} onValueChange={(v) => status.mutate({ id: o.id, status: v })}>
                <SelectTrigger className="w-32" aria-label={`Status de ${numeroOrc(o.numero)}`}><SelectValue /></SelectTrigger>
                <SelectContent>{STATUS.map((s) => <SelectItem key={s.v} value={s.v}>{s.r}</SelectItem>)}</SelectContent>
              </Select>
              <Button size="sm" variant="outline" onClick={() => void pdf(o)}><Download className="size-4" aria-hidden />Baixar PDF</Button>
            </li>
          ))}
        </ul>
      )}
      {paginas > 1 && (
        <div className="flex items-center justify-between">
          <Button size="sm" variant="outline" disabled={pagina === 0} onClick={() => setPagina((x) => x - 1)}>Anterior</Button>
          <span className="text-xs text-muted-foreground">Página {pagina + 1} de {paginas}</span>
          <Button size="sm" variant="outline" disabled={pagina + 1 >= paginas} onClick={() => setPagina((x) => x + 1)}>Próxima</Button>
        </div>
      )}
      {novo && <OrcamentoDialog open={novo} onOpenChange={setNovo} />}
      <NegocioPendente open={aviso} onOpenChange={setAviso} />
    </div>
  );
}
