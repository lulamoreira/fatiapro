import { useFatiadorLabel } from "@/hooks/use-fatiador-label";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bookmark } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Json, Tables } from "@/integrations/supabase/types";
import { fatiadorLabel, impressoraSemBico, materialTexto, nomeFilamento } from "@/lib/fatia";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

export interface AjusteModelo {
  titulo: string;
  ajustes?: Record<string, Json>;
}

interface OpcoesJob {
  impressora?: string | null;
  bico?: string;
  filamento?: { tipo?: string | null; marca?: string | null; linha?: string | null };
  finalidades?: string[];
  prioridades?: string[];
  pasta_saida?: string | null;
}

export function sugerirNomeModelo(o: OpcoesJob): string {
  const partes = [
    o.impressora ? impressoraSemBico(o.impressora) : null,
    o.filamento?.linha ? nomeFilamento(o.filamento.marca ?? "", o.filamento.linha) : null,
    o.prioridades?.[0] ?? null,
  ].filter((x): x is string => !!x);
  return partes.join(" · ") || "Meu modelo";
}

/** Approved proposal items for a job (from its 'proposta' and 'aprovacao' events). */
export function useAjustesAprovados(jobId: string, enabled: boolean) {
  return useQuery({
    queryKey: ["ajustes_aprovados", jobId],
    enabled,
    queryFn: async (): Promise<AjusteModelo[]> => {
      const { data, error } = await supabase
        .from("job_events")
        .select("id, tipo, conteudo, criado_em", { count: "exact" })
        .eq("job_id", jobId)
        .in("tipo", ["proposta", "aprovacao"])
        .order("criado_em", { ascending: false })
        .order("id", { ascending: false })
        .range(0, 199);
      if (error) throw error;
      const aprov = data.find((e) => e.tipo === "aprovacao");
      if (!aprov) return [];
      const ids = new Set(((aprov.conteudo as { itens_aprovados?: unknown })?.itens_aprovados as string[] | undefined) ?? []);
      const prop = data.find((e) => e.tipo === "proposta" && Date.parse(e.criado_em) <= Date.parse(aprov.criado_em));
      const itens = ((prop?.conteudo as { itens?: unknown })?.itens as { id: string; titulo: string; ajustes?: unknown }[] | undefined) ?? [];
      return itens
        .filter((i) => ids.has(i.id))
        .map((i) =>
          i.ajustes && typeof i.ajustes === "object" && !Array.isArray(i.ajustes)
            ? { titulo: i.titulo, ajustes: i.ajustes as Record<string, Json> }
            : { titulo: i.titulo },
        );
    },
  });
}

export function SalvarModeloDialog({ job, trigger }: { job: Tables<"jobs">; trigger?: "icon" | "button" }) {
  const rotuloFat = useFatiadorLabel();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const o = (job.opcoes ?? {}) as OpcoesJob;
  const sugestao = useMemo(() => sugerirNomeModelo(o), [job.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const [nome, setNome] = useState(sugestao);
  const [erroNome, setErroNome] = useState<string | null>(null);
  const [incluir, setIncluir] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const { data: ajustes = [] } = useAjustesAprovados(job.id, open);

  useEffect(() => {
    if (open) { setNome(sugestao); setErroNome(null); }
  }, [open, sugestao]);

  async function salvar() {
    const n = nome.trim();
    if (!n) { setErroNome("Dê um nome ao modelo."); return; }
    setSalvando(true);
    const opcoes = {
      ...(job.opcoes as Record<string, Json>),
      roteiro: job.roteiro,
      fatiador: job.fatiador,
      motor: job.motor,
      ajustes_modelo: incluir && ajustes.length ? (ajustes as unknown as Json) : [],
    };
    const { error } = await supabase.from("presets").insert({ nome: n.slice(0, 80), opcoes: opcoes as Json });
    setSalvando(false);
    if (error) {
      if (error.code === "23505") setErroNome("Você já tem um modelo com esse nome.");
      else toast.error("Não foi possível salvar o modelo.");
      return;
    }
    qc.invalidateQueries({ queryKey: ["presets"] });
    qc.invalidateQueries({ queryKey: ["modelos"] });
    toast.success("Modelo salvo. Use em Nova análise → Meus modelos.");
    setOpen(false);
  }

  const fil = o.filamento;
  const linhas: [string, string][] = [
    ["Fatiador", rotuloFat(job.fatiador)],
    ["Impressora", o.impressora ?? "—"],
    ["Bico", o.bico ? `${o.bico} mm` : "—"],
    ["Filamento", [fil?.tipo, materialTexto(fil?.marca ?? "", fil?.linha ?? "")].filter(Boolean).join(" · ") || "—"],
    ["Para que serve", o.finalidades?.join(", ") || "—"],
    ["Prioridades", o.prioridades?.map((p, i) => `${i + 1}º ${p}`).join(", ") || "—"],
    ["Pasta de saída", o.pasta_saida ?? "padrão do computador"],
  ];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant={trigger === "button" ? "outline" : "ghost"} onClick={(e) => e.stopPropagation()}>
          <Bookmark className="size-4" aria-hidden />Salvar como modelo
        </Button>
      </DialogTrigger>
      <DialogContent onClick={(e) => e.stopPropagation()}>
        <DialogHeader><DialogTitle>Salvar como modelo</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="nome-modelo">Nome do modelo</Label>
            <Input id="nome-modelo" value={nome} maxLength={80} onChange={(e) => { setNome(e.target.value); setErroNome(null); }} aria-invalid={!!erroNome} />
            {erroNome && <p className="text-xs text-destructive" role="alert">{erroNome}</p>}
          </div>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 rounded-xl bg-muted p-3 text-sm">
            {linhas.map(([k, v]) => (<div key={k} className="contents"><dt className="text-muted-foreground">{k}</dt><dd className="break-words">{v}</dd></div>))}
          </dl>
          {ajustes.length > 0 && (
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm font-medium">
                <Checkbox checked={incluir} onCheckedChange={(v) => setIncluir(v === true)} />
                Incluir as mudanças aprovadas nesta análise
              </label>
              <ul className="list-disc space-y-0.5 pl-9 text-sm text-muted-foreground">{ajustes.map((a) => <li key={a.titulo}>{a.titulo}</li>)}</ul>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button onClick={salvar} disabled={salvando}>{salvando ? "Salvando…" : "Salvar modelo"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
