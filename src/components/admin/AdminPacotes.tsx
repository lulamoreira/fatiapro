import { useState } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { adminMpEventos, adminPacotes, adminPedidos, adminSalvarPacote } from "@/lib/admin-pacotes.functions";
import { STATUS_PEDIDO, brlCentavos } from "@/lib/mercadopago";
import { Tag } from "@/components/fatia/Chip";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";

type Pacote = { id: string | null; nome: string; creditos: number; preco_centavos: number; validade_meses: number; destaque: boolean; ativo: boolean; ordem: number };
const NOVO: Pacote = { id: null, nome: "", creditos: 10, preco_centavos: 1990, validade_meses: 12, destaque: false, ativo: true, ordem: 10 };
const dataHora = (iso: string) => new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

export function AdminPacotes() {
  const fn = useServerFn(adminPacotes);
  const q = useQuery({ queryKey: ["admin", "pacotes"], queryFn: () => fn() });
  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Pacotes</h2>
        {!q.data ? <Skeleton className="h-32" /> : (
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {q.data.map((p) => <PacoteForm key={p.id} inicial={p} />)}
            <PacoteForm inicial={NOVO} />
          </div>
        )}
      </section>
      <Pedidos />
      <Eventos />
    </div>
  );
}

function PacoteForm({ inicial }: { inicial: Pacote }) {
  const qc = useQueryClient();
  const salvar = useServerFn(adminSalvarPacote);
  const [v, setV] = useState({ ...inicial, preco: (inicial.preco_centavos / 100).toFixed(2).replace(".", ",") });
  const preco = Math.round(Number(v.preco.replace(",", ".")) * 100);
  const invalido = !v.nome.trim() || !(v.creditos > 0) || !(preco > 0) || !(v.validade_meses >= 1 && v.validade_meses <= 60);
  const m = useMutation({
    mutationFn: () => salvar({ data: { id: v.id, nome: v.nome, creditos: v.creditos, preco_centavos: preco, validade_meses: v.validade_meses, destaque: v.destaque, ativo: v.ativo, ordem: v.ordem } }),
    onSuccess: () => { toast.success("Pacote salvo."); qc.invalidateQueries({ queryKey: ["admin", "pacotes"] }); if (!v.id) setV({ ...NOVO, preco: "19,90" }); },
    onError: (e) => toast.error((e as Error).message),
  });
  const pid = v.id ?? "novo";
  const num = (k: "creditos" | "validade_meses" | "ordem") => (e: React.ChangeEvent<HTMLInputElement>) => setV((p) => ({ ...p, [k]: Math.trunc(Number(e.target.value)) }));
  return (
    <form className="space-y-3 rounded-2xl bg-card p-4 shadow-sm" onSubmit={(e) => { e.preventDefault(); m.mutate(); }}>
      <p className="font-semibold">{v.id ? inicial.nome : "Novo pacote"}</p>
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2 space-y-1"><Label htmlFor={`n-${pid}`}>Nome</Label><Input id={`n-${pid}`} value={v.nome} onChange={(e) => setV((p) => ({ ...p, nome: e.target.value }))} /></div>
        <div className="space-y-1"><Label htmlFor={`c-${pid}`}>Créditos</Label><Input id={`c-${pid}`} type="number" min={1} value={v.creditos} onChange={num("creditos")} /></div>
        <div className="space-y-1"><Label htmlFor={`p-${pid}`}>Preço (R$)</Label><Input id={`p-${pid}`} inputMode="decimal" value={v.preco} onChange={(e) => setV((p) => ({ ...p, preco: e.target.value }))} /></div>
        <div className="space-y-1"><Label htmlFor={`v-${pid}`}>Validade (meses)</Label><Input id={`v-${pid}`} type="number" min={1} max={60} value={v.validade_meses} onChange={num("validade_meses")} /></div>
        <div className="space-y-1"><Label htmlFor={`o-${pid}`}>Ordem</Label><Input id={`o-${pid}`} type="number" min={0} value={v.ordem} onChange={num("ordem")} /></div>
      </div>
      <div className="flex flex-wrap gap-5 text-sm">
        <label className="flex items-center gap-2"><Switch checked={v.destaque} onCheckedChange={(c) => setV((p) => ({ ...p, destaque: c }))} />Destaque</label>
        <label className="flex items-center gap-2"><Switch checked={v.ativo} onCheckedChange={(c) => setV((p) => ({ ...p, ativo: c }))} />Ativo</label>
      </div>
      <Button type="submit" size="sm" disabled={invalido || m.isPending}>{m.isPending ? "Salvando…" : v.id ? "Salvar" : "Criar pacote"}</Button>
    </form>
  );
}

const FILTROS = [null, "pendente", "aprovado", "recusado", "cancelado", "estornado", "expirado"] as const;

function Pedidos() {
  const fn = useServerFn(adminPedidos);
  const [status, setStatus] = useState<(typeof FILTROS)[number]>(null);
  const [pagina, setPagina] = useState(1);
  const q = useQuery({ queryKey: ["admin", "pedidos", status, pagina], queryFn: () => fn({ data: { status, pagina } }), placeholderData: keepPreviousData });
  const paginas = Math.max(1, Math.ceil((q.data?.total ?? 0) / (q.data?.por_pagina ?? 20)));
  return (
    <section className="space-y-3 rounded-2xl bg-card p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold">Pedidos</h2>
        <select aria-label="Filtrar por status" className="rounded-xl border bg-background px-3 py-1.5 text-sm" value={status ?? ""} onChange={(e) => { setStatus((e.target.value || null) as typeof status); setPagina(1); }}>
          {FILTROS.map((f) => <option key={f ?? "todos"} value={f ?? ""}>{f ? STATUS_PEDIDO[f] : "Todos"}</option>)}
        </select>
      </div>
      {!q.data ? <Skeleton className="h-20" /> : !q.data.linhas.length ? <p className="text-sm text-muted-foreground">Nenhum pedido.</p> : (
        <ul className="divide-y text-sm">{q.data.linhas.map((p) => (
          <li key={p.id} className="flex flex-wrap justify-between gap-2 py-2">
            <span className="min-w-0"><span className="block truncate font-medium">{p.email}</span><span className="text-xs text-muted-foreground">{dataHora(p.criado_em)} · {p.pacotes?.nome ?? `${p.creditos} créditos`}{p.metodo ? ` · ${p.metodo}` : ""}</span></span>
            <span className="flex items-center gap-2"><span className="tabular">{brlCentavos(p.valor_centavos)}</span><Tag tone={p.status === "aprovado" ? "success" : "muted"}>{STATUS_PEDIDO[p.status] ?? p.status}</Tag></span>
          </li>
        ))}</ul>
      )}
      <Paginar pagina={pagina} paginas={paginas} setPagina={setPagina} />
    </section>
  );
}

function Eventos() {
  const fn = useServerFn(adminMpEventos);
  const [pagina, setPagina] = useState(1);
  const q = useQuery({ queryKey: ["admin", "mp-eventos", pagina], queryFn: () => fn({ data: { pagina } }), placeholderData: keepPreviousData });
  const paginas = Math.max(1, Math.ceil((q.data?.total ?? 0) / (q.data?.por_pagina ?? 20)));
  return (
    <section className="space-y-3 rounded-2xl bg-card p-4 shadow-sm">
      <h2 className="font-semibold">Notificações do Mercado Pago</h2>
      {!q.data ? <Skeleton className="h-20" /> : !q.data.linhas.length ? <p className="text-sm text-muted-foreground">Nenhuma notificação recebida.</p> : (
        <ul className="divide-y text-sm">{q.data.linhas.map((e) => (
          <li key={e.id} className="flex justify-between gap-2 py-2">
            <span className="text-muted-foreground">{dataHora(e.criado_em)} · pagamento {e.payment_id ?? "—"} · {e.status ?? "—"}</span>
            <Tag tone={e.valido ? "success" : "muted"}>{e.valido ? "Assinatura válida" : "Assinatura inválida"}</Tag>
          </li>
        ))}</ul>
      )}
      <Paginar pagina={pagina} paginas={paginas} setPagina={setPagina} />
    </section>
  );
}

function Paginar({ pagina, paginas, setPagina }: { pagina: number; paginas: number; setPagina: (f: (x: number) => number) => void }) {
  if (paginas <= 1) return null;
  return (
    <div className="flex items-center justify-between pt-1">
      <Button size="sm" variant="outline" disabled={pagina <= 1} onClick={() => setPagina((x) => x - 1)}>Anterior</Button>
      <span className="text-xs text-muted-foreground">Página {pagina} de {paginas}</span>
      <Button size="sm" variant="outline" disabled={pagina >= paginas} onClick={() => setPagina((x) => x + 1)}>Próxima</Button>
    </div>
  );
}
