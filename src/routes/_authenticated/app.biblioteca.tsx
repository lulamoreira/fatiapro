import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { Box, Download, Wand2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { baixar, formatBytes, tamanhoArquivo } from "@/lib/storage";
import { nomeDownloadOriginal, nomeDownloadOtimizado } from "@/lib/nomes";
import { escapeLike } from "@/components/fatia/BibliotecaPicker";
import { Tag } from "@/components/fatia/Chip";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const POR_PAGINA = 24;

export const Route = createFileRoute("/_authenticated/app/biblioteca")({
  validateSearch: z.object({ pagina: z.number().int().min(0).catch(0).default(0), q: z.string().max(120).catch("").default(""), destaque: z.string().uuid().optional().catch(undefined) }),
  head: () => ({ meta: [{ title: "Biblioteca de peças — FatiaPro" }, { name: "description", content: "Peças guardadas para reimprimir ou reanalisar." }] }),
  component: BibliotecaPage,
});

function BibliotecaPage() {
  const { pagina, q, destaque } = Route.useSearch();
  const [realce, setRealce] = useState<string | null>(null);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [busca, setBusca] = useState(q);
  const [editar, setEditar] = useState<{ id: string; nome: string; observacao: string } | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["biblioteca", pagina, q],
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const from = pagina * POR_PAGINA;
      let query = supabase
        .from("pecas")
        .select("*, jobs(nome_peca)", { count: "exact" })
        .order("criado_em", { ascending: false })
        .order("id", { ascending: false })
        .range(from, from + POR_PAGINA - 1);
      if (q.trim()) query = query.ilike("nome", `%${escapeLike(q.trim())}%`);
      const { data, error, count } = await query;
      if (error) throw error;
      return { rows: data, total: count ?? 0 };
    },
  });

  // Space used: sum of distinct referenced object sizes (all pages).
  const { data: espaco } = useQuery({
    queryKey: ["biblioteca", "espaco"],
    queryFn: async () => {
      const paths = new Set<string>();
      for (let from = 0; ; from += 1000) {
        const { data, error, count } = await supabase
          .from("pecas")
          .select("arquivo_original_path, arquivo_otimizado_path", { count: "exact" })
          .order("criado_em", { ascending: false })
          .order("id", { ascending: false })
          .range(from, from + 999);
        if (error) throw error;
        for (const r of data) { if (r.arquivo_original_path) paths.add(r.arquivo_original_path); if (r.arquivo_otimizado_path) paths.add(r.arquivo_otimizado_path); }
        if (from + 1000 >= (count ?? 0)) break;
      }
      const tams = await Promise.all([...paths].map((p) => tamanhoArquivo(p)));
      return tams.reduce<number>((a, t) => a + (t ?? 0), 0);
    },
  });

  // Highlight the freshly saved piece for 3s and scroll to it.
  const temDestaque = !!destaque && !!data?.rows.some((r) => r.id === destaque);
  useEffect(() => {
    if (!temDestaque || !destaque) return undefined;
    setRealce(destaque);
    requestAnimationFrame(() => document.getElementById(`peca-${destaque}`)?.scrollIntoView({ behavior: "smooth", block: "center" }));
    const t = window.setTimeout(() => setRealce(null), 3000);
    return () => window.clearTimeout(t);
  }, [temDestaque, destaque]);

  const total = Math.max(1, Math.ceil((data?.total ?? 0) / POR_PAGINA));
  const invalidar = () => qc.invalidateQueries({ queryKey: ["biblioteca"] });

  const remover = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("pecas").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { invalidar(); toast.success("Removida da biblioteca."); },
    onError: () => toast.error("Não foi possível remover."),
  });
  const salvarEdicao = useMutation({
    mutationFn: async (e: { id: string; nome: string; observacao: string }) => {
      const { error } = await supabase.from("pecas").update({ nome: e.nome.trim().slice(0, 120), observacao: e.observacao.trim() ? e.observacao.trim().slice(0, 1000) : null }).eq("id", e.id);
      if (error) throw error;
    },
    onSuccess: () => { invalidar(); setEditar(null); },
    onError: () => toast.error("Não foi possível salvar."),
  });

  async function onBaixar(path: string, nome: string) {
    try { await baixar(path, nome); } catch { toast.error("Não foi possível gerar o link de download."); }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-wrap items-center gap-4">
          <h1 className="text-[30px] font-bold tracking-[-0.02em]">Biblioteca de peças</h1>
          <Button asChild><Link to="/app/nova-analise"><Wand2 className="size-4" aria-hidden />Nova análise</Link></Button>
        </div>
        <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); navigate({ to: "/app/biblioteca", search: { pagina: 0, q: busca } }); }}>
          <Input placeholder="Buscar por nome" value={busca} onChange={(e) => setBusca(e.target.value)} aria-label="Buscar por nome" className="w-60" />
          <Button type="submit" variant="outline">Buscar</Button>
        </form>
      </div>

      {isLoading ? <Skeleton className="h-48 rounded-2xl" /> : !data?.rows.length ? (
        <div className="rounded-2xl border border-dashed p-10 text-center text-muted-foreground">
          <Box className="mx-auto mb-3 size-8" aria-hidden />
          {q ? "Nenhuma peça encontrada com esse nome." : "Guarde peças a partir do Histórico para reimprimir ou reanalisar depois."}
          {!q && <div className="mt-4"><Button asChild><Link to="/app/nova-analise"><Wand2 className="size-4" aria-hidden />Nova análise</Link></Button></div>}
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {data.rows.map((p) => (
            <li key={p.id} id={`peca-${p.id}`} className={cn("flex flex-col rounded-2xl border bg-card p-5", realce === p.id && "animate-destaque-peca border-2")}>
              <h2 className="break-words text-lg font-semibold">{p.nome}</h2>
              <p className="text-xs text-muted-foreground">{new Date(p.criado_em).toLocaleDateString("pt-BR")}</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <Tag tone={p.arquivo_original_path ? "success" : "muted"}>Original</Tag>
                <Tag tone={p.arquivo_otimizado_path ? "success" : "muted"}>Otimizado</Tag>
              </div>
              {p.arquivo_original_path && <p className="mt-2 break-all text-xs"><span className="text-muted-foreground">Original: </span>{nomeDownloadOriginal(p.nome_arquivo_original, p.jobs?.nome_peca)}</p>}
              {p.arquivo_otimizado_path && <p className="break-all text-xs"><span className="text-muted-foreground">Otimizado: </span>{nomeDownloadOtimizado(p.nome_arquivo_otimizado)}</p>}
              {p.observacao && <p className="mt-2 whitespace-pre-line text-sm text-muted-foreground">{p.observacao}</p>}
              <div className="mt-4 flex flex-wrap gap-2">
                {p.arquivo_original_path && <Button size="sm" variant="outline" onClick={() => onBaixar(p.arquivo_original_path!, nomeDownloadOriginal(p.nome_arquivo_original, p.jobs?.nome_peca))}><Download className="size-4" aria-hidden />Baixar original</Button>}
                {p.arquivo_otimizado_path && <Button size="sm" variant="outline" onClick={() => onBaixar(p.arquivo_otimizado_path!, nomeDownloadOtimizado(p.nome_arquivo_otimizado))}><Download className="size-4" aria-hidden />Baixar otimizado</Button>}
                {p.arquivo_original_path && <Button size="sm" onClick={() => navigate({ to: "/app/nova-analise", search: { peca: p.id } })}>Nova análise com esta peça</Button>}
                {p.job_id && <Button asChild size="sm" variant="ghost"><Link to="/app/analise/$id" params={{ id: p.job_id }}>Ver análise de origem</Link></Button>}
                <Button size="sm" variant="ghost" onClick={() => setEditar({ id: p.id, nome: p.nome, observacao: p.observacao ?? "" })}>Editar</Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild><Button size="sm" variant="ghost" className="text-destructive">Remover da biblioteca</Button></AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Remover “{p.nome}” da biblioteca?</AlertDialogTitle>
                      <AlertDialogDescription>Os arquivos continuam ligados às análises.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Voltar</AlertDialogCancel>
                      <AlertDialogAction onClick={() => remover.mutate(p.id)}>Remover</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
        <span className="text-muted-foreground">Página {pagina + 1} de {total} · Espaço usado: {espaco == null ? "…" : formatBytes(espaco)}</span>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" disabled={pagina === 0} onClick={() => navigate({ to: "/app/biblioteca", search: { pagina: pagina - 1, q } })}>Anterior</Button>
          <Button variant="outline" size="sm" disabled={pagina + 1 >= total} onClick={() => navigate({ to: "/app/biblioteca", search: { pagina: pagina + 1, q } })}>Próxima</Button>
        </div>
      </div>

      <Dialog open={!!editar} onOpenChange={(v) => !v && setEditar(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Editar peça</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5"><Label htmlFor="ed-nome">Nome</Label><Input id="ed-nome" maxLength={120} value={editar?.nome ?? ""} onChange={(e) => setEditar((x) => (x ? { ...x, nome: e.target.value } : x))} /></div>
            <div className="space-y-1.5"><Label htmlFor="ed-obs">Observação</Label><Textarea id="ed-obs" maxLength={1000} value={editar?.observacao ?? ""} onChange={(e) => setEditar((x) => (x ? { ...x, observacao: e.target.value } : x))} /></div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditar(null)}>Cancelar</Button>
            <Button disabled={!editar?.nome.trim() || salvarEdicao.isPending} onClick={() => editar && salvarEdicao.mutate(editar)}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
