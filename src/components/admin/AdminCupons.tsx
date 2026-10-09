import { useState } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { adminCupomUsos, adminCupons, adminSalvarCupom } from "@/lib/cupons.functions";
import { dataBR } from "@/lib/cupons";
import { Tag } from "@/components/fatia/Chip";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";

interface Cupom { id: string | null; codigo: string; creditos: number; validade_dias: number; inicio: string; fim: string | null; limite_total: number | null; so_primeira_compra: boolean; ativo: boolean; usos?: number }
type Linha = Cupom & { id: string; usos: number };

/** datetime-local <-> ISO (browser local time). */
const paraLocal = (iso: string | null) => { if (!iso) return ""; const d = new Date(iso); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16); };
const paraIso = (v: string) => (v ? new Date(v).toISOString() : null);

export function AdminCupons() {
  const fn = useServerFn(adminCupons);
  const [pagina, setPagina] = useState(1);
  const [editando, setEditando] = useState<Cupom | null>(null);
  const q = useQuery({ queryKey: ["admin", "cupons", pagina], queryFn: () => fn({ data: { pagina } }), placeholderData: keepPreviousData });
  const paginas = Math.max(1, Math.ceil((q.data?.total ?? 0) / (q.data?.por_pagina ?? 20)));
  return (
    <div className="space-y-5">
      <div className="flex justify-end"><Button onClick={() => setEditando({ id: null, codigo: "", creditos: 5, validade_dias: 90, inicio: new Date().toISOString(), fim: null, limite_total: null, so_primeira_compra: false, ativo: true })}>Novo cupom</Button></div>
      {editando && <CupomForm key={editando.id ?? "novo"} inicial={editando} fechar={() => setEditando(null)} />}
      {!q.data ? <Skeleton className="h-32" /> : !q.data.linhas.length ? <p className="text-sm text-muted-foreground">Nenhum cupom ainda.</p> : (
        <ul className="space-y-3">{(q.data.linhas as Linha[]).map((c) => <CupomLinha key={c.id} c={c} editar={() => setEditando(c)} />)}</ul>
      )}
      {paginas > 1 && (
        <div className="flex items-center justify-between">
          <Button size="sm" variant="outline" disabled={pagina <= 1} onClick={() => setPagina((x) => x - 1)}>Anterior</Button>
          <span className="text-xs text-muted-foreground">Página {pagina} de {paginas}</span>
          <Button size="sm" variant="outline" disabled={pagina >= paginas} onClick={() => setPagina((x) => x + 1)}>Próxima</Button>
        </div>
      )}
    </div>
  );
}

function CupomLinha({ c, editar }: { c: Linha; editar: () => void }) {
  const qc = useQueryClient();
  const salvar = useServerFn(adminSalvarCupom);
  const [verUsos, setVerUsos] = useState(false);
  const desativar = useMutation({
    mutationFn: () => salvar({ data: { ...c, ativo: false } }),
    onSuccess: () => { toast.success("Cupom desativado."); qc.invalidateQueries({ queryKey: ["admin", "cupons"] }); },
    onError: (e) => toast.error((e as Error).message),
  });
  return (
    <li className="space-y-2 rounded-2xl bg-card p-4 text-sm shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="flex items-center gap-2 font-mono font-semibold">{c.codigo}<Tag tone={c.ativo ? "success" : "muted"}>{c.ativo ? "Ativo" : "Inativo"}</Tag>{c.so_primeira_compra && <Tag tone="primary">Só primeira compra</Tag>}</span>
        <span className="flex gap-2">
          <Button size="sm" variant="outline" onClick={editar}>Editar</Button>
          {c.ativo && <Button size="sm" variant="outline" disabled={desativar.isPending} onClick={() => desativar.mutate()}>Desativar</Button>}
          <Button size="sm" variant="ghost" onClick={() => setVerUsos((v) => !v)}>{verUsos ? "Ocultar usos" : "Quem usou"}</Button>
        </span>
      </div>
      <p className="text-muted-foreground">+{c.creditos} créditos · valem {c.validade_dias} dias · {c.usos}{c.limite_total ? ` de ${c.limite_total}` : ""} usos · de {dataBR(c.inicio)}{c.fim ? ` até ${dataBR(c.fim)}` : " sem fim"}</p>
      {verUsos && <Usos id={c.id} />}
    </li>
  );
}

function Usos({ id }: { id: string }) {
  const fn = useServerFn(adminCupomUsos);
  const [pagina, setPagina] = useState(1);
  const q = useQuery({ queryKey: ["admin", "cupom-usos", id, pagina], queryFn: () => fn({ data: { cupom_id: id, pagina } }), placeholderData: keepPreviousData });
  const paginas = Math.max(1, Math.ceil((q.data?.total ?? 0) / (q.data?.por_pagina ?? 20)));
  if (!q.data) return <Skeleton className="h-10" />;
  if (!q.data.linhas.length) return <p className="text-xs text-muted-foreground">Ninguém usou ainda.</p>;
  return (
    <div className="space-y-1">
      <ul className="divide-y text-xs">{q.data.linhas.map((u) => <li key={u.id} className="flex justify-between py-1.5"><span className="truncate">{u.email}</span><span className="text-muted-foreground">{dataBR(u.criado_em)}</span></li>)}</ul>
      {paginas > 1 && <div className="flex justify-between"><Button size="sm" variant="ghost" disabled={pagina <= 1} onClick={() => setPagina((x) => x - 1)}>Anterior</Button><Button size="sm" variant="ghost" disabled={pagina >= paginas} onClick={() => setPagina((x) => x + 1)}>Próxima</Button></div>}
    </div>
  );
}

function CupomForm({ inicial, fechar }: { inicial: Cupom; fechar: () => void }) {
  const qc = useQueryClient();
  const salvar = useServerFn(adminSalvarCupom);
  const [v, setV] = useState({ ...inicial, inicioL: paraLocal(inicial.inicio), fimL: paraLocal(inicial.fim), limite: inicial.limite_total ? String(inicial.limite_total) : "" });
  const m = useMutation({
    mutationFn: () => salvar({ data: {
      id: v.id, codigo: v.codigo, creditos: v.creditos, validade_dias: v.validade_dias,
      inicio: paraIso(v.inicioL) ?? new Date().toISOString(), fim: paraIso(v.fimL),
      limite_total: v.limite ? Math.trunc(Number(v.limite)) : null, so_primeira_compra: v.so_primeira_compra, ativo: v.ativo,
    } }),
    onSuccess: () => { toast.success("Cupom salvo."); qc.invalidateQueries({ queryKey: ["admin", "cupons"] }); fechar(); },
    onError: (e) => toast.error((e as Error).message),
  });
  const codigoOk = /^[A-Z0-9-]{3,30}$/.test(v.codigo.trim().toUpperCase());
  return (
    <form className="space-y-3 rounded-2xl bg-card p-4 shadow-sm" onSubmit={(e) => { e.preventDefault(); m.mutate(); }}>
      <p className="font-semibold">{v.id ? `Editar ${inicial.codigo}` : "Novo cupom"}</p>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <div className="space-y-1"><Label htmlFor="cp-cod">Código</Label><Input id="cp-cod" className="uppercase" maxLength={30} value={v.codigo} aria-invalid={!codigoOk} onChange={(e) => setV((p) => ({ ...p, codigo: e.target.value }))} /></div>
        <div className="space-y-1"><Label htmlFor="cp-cr">Créditos</Label><Input id="cp-cr" type="number" min={1} value={v.creditos} onChange={(e) => setV((p) => ({ ...p, creditos: Math.trunc(Number(e.target.value)) }))} /></div>
        <div className="space-y-1"><Label htmlFor="cp-val">Validade dos créditos (dias)</Label><Input id="cp-val" type="number" min={1} max={730} value={v.validade_dias} onChange={(e) => setV((p) => ({ ...p, validade_dias: Math.trunc(Number(e.target.value)) }))} /></div>
        <div className="space-y-1"><Label htmlFor="cp-ini">Início</Label><Input id="cp-ini" type="datetime-local" value={v.inicioL} onChange={(e) => setV((p) => ({ ...p, inicioL: e.target.value }))} /></div>
        <div className="space-y-1"><Label htmlFor="cp-fim">Fim (opcional)</Label><Input id="cp-fim" type="datetime-local" value={v.fimL} onChange={(e) => setV((p) => ({ ...p, fimL: e.target.value }))} /></div>
        <div className="space-y-1"><Label htmlFor="cp-lim">Limite total (opcional)</Label><Input id="cp-lim" type="number" min={1} placeholder="Sem limite" value={v.limite} onChange={(e) => setV((p) => ({ ...p, limite: e.target.value }))} /></div>
      </div>
      <div className="flex flex-wrap gap-5 text-sm">
        <label className="flex items-center gap-2"><Switch checked={v.so_primeira_compra} onCheckedChange={(c) => setV((p) => ({ ...p, so_primeira_compra: c }))} />Só primeira compra</label>
        <label className="flex items-center gap-2"><Switch checked={v.ativo} onCheckedChange={(c) => setV((p) => ({ ...p, ativo: c }))} />Ativo</label>
      </div>
      <div className="flex gap-2">
        <Button type="submit" disabled={!codigoOk || !(v.creditos > 0) || m.isPending}>{m.isPending ? "Salvando…" : "Salvar"}</Button>
        <Button type="button" variant="ghost" onClick={fechar}>Cancelar</Button>
      </div>
    </form>
  );
}
