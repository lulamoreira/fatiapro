import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { FolderPlus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { formatBytes, tamanhoArquivo } from "@/lib/storage";
import { nomesDoJob } from "@/lib/nomes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export function caminhosDoJob(job: Pick<Tables<"jobs">, "arquivo_path" | "resultado">) {
  const r = (job.resultado ?? {}) as { arquivo_nuvem_path?: unknown; original_nuvem_path?: unknown };
  const original = job.arquivo_path ?? (typeof r.original_nuvem_path === "string" ? r.original_nuvem_path : null);
  const otimizado = typeof r.arquivo_nuvem_path === "string" ? r.arquivo_nuvem_path : null;
  return { original, otimizado };
}

export function SalvarBibliotecaDialog({ job, trigger }: { job: Tables<"jobs">; trigger?: "icon" | "button" }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const sugestao = (job.nome_peca ?? "peca-aberta").replace(/\.[^.]+$/, "");
  const [nome, setNome] = useState(sugestao);
  const [obs, setObs] = useState("");
  const [salvando, setSalvando] = useState(false);
  const { original, otimizado } = caminhosDoJob(job);
  const nomes = nomesDoJob(job);

  useEffect(() => { if (open) { setNome(sugestao); setObs(""); } }, [open, sugestao]);

  const { data: info } = useQuery({
    queryKey: ["biblioteca_info", job.id],
    enabled: open,
    queryFn: async () => {
      const [ja, tOrig, tOtim] = await Promise.all([
        supabase.from("pecas").select("id", { count: "exact" }).eq("job_id", job.id).order("criado_em", { ascending: false }).order("id", { ascending: false }).range(0, 0),
        tamanhoArquivo(original),
        tamanhoArquivo(otimizado),
      ]);
      return { jaSalva: (ja.count ?? 0) > 0, tOrig, tOtim };
    },
  });

  async function salvar() {
    if (!nome.trim()) return;
    setSalvando(true);
    const { error } = await supabase.from("pecas").insert({
      nome: nome.trim().slice(0, 120),
      observacao: obs.trim() ? obs.trim().slice(0, 1000) : null,
      arquivo_original_path: info?.tOrig != null ? original : null,
      arquivo_otimizado_path: info?.tOtim != null ? otimizado : null,
      nome_arquivo_original: info?.tOrig != null ? nomes.original : null,
      nome_arquivo_otimizado: info?.tOtim != null ? nomes.otimizado : null,
      job_id: job.id,
    });
    setSalvando(false);
    if (error) { toast.error("Não foi possível salvar na biblioteca."); return; }
    qc.invalidateQueries({ queryKey: ["biblioteca"] });
    qc.invalidateQueries({ queryKey: ["biblioteca_info", job.id] });
    toast.success("Peça salva na biblioteca.");
    setOpen(false);
  }

  const Item = ({ t, tam }: { t: string; tam: number | null | undefined }) => (
    <li className={cn("flex justify-between gap-3 text-sm", tam == null && "text-muted-foreground")}>
      <span>{t}</span><span className="tabular">{tam == null ? "não disponível nesta análise" : formatBytes(tam)}</span>
    </li>
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant={trigger === "button" ? "outline" : "ghost"} onClick={(e) => e.stopPropagation()}>
          <FolderPlus className="size-4" aria-hidden />Salvar na biblioteca
        </Button>
      </DialogTrigger>
      <DialogContent onClick={(e) => e.stopPropagation()}>
        <DialogHeader><DialogTitle>Salvar na biblioteca</DialogTitle></DialogHeader>
        {info?.jaSalva ? (
          <p className="text-sm">Já está na biblioteca. <Link to="/app/biblioteca" className="font-semibold text-primary-ink underline">Ver biblioteca</Link></p>
        ) : (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="nome-peca">Nome</Label>
              <Input id="nome-peca" value={nome} maxLength={120} onChange={(e) => setNome(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="obs-peca">Observação (opcional)</Label>
              <Textarea id="obs-peca" value={obs} maxLength={1000} onChange={(e) => setObs(e.target.value)} />
            </div>
            <ul className="space-y-1 rounded-xl bg-muted p-3">
              <Item t="Arquivo original" tam={info ? info.tOrig : undefined} />
              <Item t="Arquivo otimizado" tam={info ? info.tOtim : undefined} />
            </ul>
          </div>
        )}
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Fechar</Button>
          {!info?.jaSalva && <Button onClick={salvar} disabled={salvando || !info || !nome.trim()}>{salvando ? "Salvando…" : "Salvar"}</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
