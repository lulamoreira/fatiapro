import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { Bookmark } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { impressoraSemBico, nomeFilamento } from "@/lib/fatia";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const POR_PAGINA = 24;

export const Route = createFileRoute("/_authenticated/app/modelos")({
  validateSearch: z.object({ pagina: z.number().int().min(0).catch(0).default(0) }),
  head: () => ({ meta: [{ title: "Meus modelos — FatiaPro" }, { name: "description", content: "Configurações reutilizáveis para suas análises." }] }),
  component: ModelosPage,
});

interface OpcoesModelo {
  impressora?: string | null;
  bico?: string;
  filamento?: { marca?: string | null; linha?: string | null };
  prioridades?: string[];
  ajustes_modelo?: unknown[];
}

function resumo(o: OpcoesModelo): string {
  return [
    o.impressora ? impressoraSemBico(o.impressora) : null,
    o.bico ? `${o.bico} mm` : null,
    o.filamento?.linha ? nomeFilamento(o.filamento.marca ?? "", o.filamento.linha) : null,
    o.prioridades?.length ? o.prioridades.join(" > ") : null,
  ].filter(Boolean).join(" · ") || "—";
}

function ModelosPage() {
  const { pagina } = Route.useSearch();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [renomear, setRenomear] = useState<{ id: string; nome: string } | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["modelos", pagina],
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const from = pagina * POR_PAGINA;
      const { data, error, count } = await supabase
        .from("presets")
        .select("*", { count: "exact" })
        .order("criado_em", { ascending: false })
        .order("id", { ascending: false })
        .range(from, from + POR_PAGINA - 1);
      if (error) throw error;
      return { rows: data, total: count ?? 0 };
    },
  });
  const total = Math.max(1, Math.ceil((data?.total ?? 0) / POR_PAGINA));
  const invalidar = () => { qc.invalidateQueries({ queryKey: ["modelos"] }); qc.invalidateQueries({ queryKey: ["presets"] }); };

  const excluir = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("presets").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { invalidar(); toast.success("Modelo excluído."); },
    onError: () => toast.error("Não foi possível excluir."),
  });

  async function salvarNome() {
    if (!renomear) return;
    const n = renomear.nome.trim();
    if (!n) { setErro("Dê um nome ao modelo."); return; }
    const { error } = await supabase.from("presets").update({ nome: n.slice(0, 80) }).eq("id", renomear.id);
    if (error) { setErro(error.code === "23505" ? "Você já tem um modelo com esse nome." : "Não foi possível renomear."); return; }
    invalidar();
    setRenomear(null);
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <h1 className="text-3xl font-bold">Meus modelos</h1>
      {isLoading ? <Skeleton className="h-48 rounded-2xl" /> : !data?.rows.length ? (
        <div className="rounded-2xl border border-dashed p-10 text-center text-muted-foreground">
          <Bookmark className="mx-auto mb-3 size-8" aria-hidden />
          Salve um modelo a partir de uma análise no <Link to="/app/historico" search={{ pagina: 0 }} className="font-semibold text-primary">Histórico</Link>.
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {data.rows.map((p) => {
            const o = (p.opcoes ?? {}) as OpcoesModelo;
            const n = Array.isArray(o.ajustes_modelo) ? o.ajustes_modelo.length : 0;
            return (
              <li key={p.id} className="flex flex-col rounded-2xl border bg-card p-5">
                <h2 className="break-words text-lg font-semibold">{p.nome}</h2>
                <p className="mt-1 text-sm text-muted-foreground">{resumo(o)}</p>
                <p className="mt-2 text-xs text-muted-foreground">{n} {n === 1 ? "mudança salva" : "mudanças salvas"} · {new Date(p.criado_em).toLocaleDateString("pt-BR")}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button size="sm" onClick={() => navigate({ to: "/app/nova-analise", search: { modelo: p.id } })}>Usar</Button>
                  <Button size="sm" variant="outline" onClick={() => { setRenomear({ id: p.id, nome: p.nome }); setErro(null); }}>Renomear</Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild><Button size="sm" variant="ghost" className="text-destructive">Excluir</Button></AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Excluir “{p.nome}”?</AlertDialogTitle>
                        <AlertDialogDescription>As análises já feitas com este modelo não são afetadas.</AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Voltar</AlertDialogCancel>
                        <AlertDialogAction onClick={() => excluir.mutate(p.id)}>Excluir</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">Página {pagina + 1} de {total}</span>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" disabled={pagina === 0} onClick={() => navigate({ to: "/app/modelos", search: { pagina: pagina - 1 } })}>Anterior</Button>
          <Button variant="outline" size="sm" disabled={pagina + 1 >= total} onClick={() => navigate({ to: "/app/modelos", search: { pagina: pagina + 1 } })}>Próxima</Button>
        </div>
      </div>

      <Dialog open={!!renomear} onOpenChange={(v) => !v && setRenomear(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Renomear modelo</DialogTitle></DialogHeader>
          <Input aria-label="Nome do modelo" value={renomear?.nome ?? ""} maxLength={80} onChange={(e) => { setRenomear((r) => (r ? { ...r, nome: e.target.value } : r)); setErro(null); }} aria-invalid={!!erro} />
          {erro && <p className="text-xs text-destructive" role="alert">{erro}</p>}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRenomear(null)}>Cancelar</Button>
            <Button onClick={salvarNome}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
