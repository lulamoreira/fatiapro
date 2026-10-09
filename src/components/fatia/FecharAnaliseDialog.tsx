import { useEffect, useMemo, useState } from "react";
import { nomePecaExibicao } from "@/lib/nome-peca";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Box, Check, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Json, Tables } from "@/integrations/supabase/types";
import { impressoraSemBico, materialTexto } from "@/lib/fatia";
import { tamanhoArquivo } from "@/lib/storage";
import { nomesDoJob } from "@/lib/nomes";
import { caminhosDoJob } from "@/components/fatia/SalvarBibliotecaDialog";
import { sugerirNomeModelo, useAjustesAprovados } from "@/components/fatia/SalvarModeloDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

interface Opc {
  modelo_id?: unknown;
  impressora?: string | null;
  bico?: string;
  filamento?: { tipo?: string | null; marca?: string | null; linha?: string | null };
  finalidades?: string[];
  prioridades?: string[];
  pasta_saida?: string | null;
}

type Passo = "biblioteca" | "modelo";

/**
 * Closing wizard for a finished analysis. Nothing is written until the last
 * step, so closing with X/Esc truly cancels everything.
 */
export function FecharAnaliseDialog({ job }: { job: Tables<"jobs"> }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const o = (job.opcoes ?? {}) as Opc;
  const usouModelo = typeof o.modelo_id === "string" && o.modelo_id.length > 0;
  const sugPeca = (job.nome_peca ?? "peca-aberta").replace(/\.[^.]+$/, "");
  const sugModelo = useMemo(() => sugerirNomeModelo(o), [job.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const { original, otimizado } = caminhosDoJob(job);
  const nomes = nomesDoJob(job);

  const [passo, setPasso] = useState<Passo>("biblioteca");
  const [guardar, setGuardar] = useState<{ nome: string; obs: string } | null>(null);
  const [nomePeca, setNomePeca] = useState(sugPeca);
  const [obs, setObs] = useState("");
  const [nomeModelo, setNomeModelo] = useState(sugModelo);
  const [erroNome, setErroNome] = useState<string | null>(null);
  const [incluir, setIncluir] = useState(true);
  const [salvando, setSalvando] = useState(false);

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
  const { data: ajustes = [] } = useAjustesAprovados(job.id, open && !usouModelo);

  const passos: Passo[] = [...(info?.jaSalva ? [] : (["biblioteca"] as Passo[])), ...(usouModelo ? [] : (["modelo"] as Passo[]))];
  const atual: Passo | null = info ? (passos.includes(passo) ? passo : passos[0] ?? null) : null;

  useEffect(() => {
    if (!open) return;
    setPasso("biblioteca"); setGuardar(null); setNomePeca(sugPeca); setObs("");
    setNomeModelo(sugModelo); setErroNome(null); setIncluir(true);
  }, [open, sugPeca, sugModelo]);

  /** Performs every write chosen in the wizard, then goes to the library. */
  async function concluir(peca: { nome: string; obs: string } | null, salvarModelo: boolean) {
    setSalvando(true);
    try {
      if (salvarModelo) {
        const n = nomeModelo.trim();
        if (!n) { setErroNome("Dê um nome ao modelo."); return; }
        const opcoes = {
          ...(job.opcoes as Record<string, Json>),
          roteiro: job.roteiro, fatiador: job.fatiador, motor: job.motor,
          ajustes_modelo: incluir && ajustes.length ? (ajustes as unknown as Json) : [],
        };
        const { error } = await supabase.from("presets").insert({ nome: n.slice(0, 80), opcoes: opcoes as Json });
        if (error) {
          if (error.code === "23505") setErroNome("Você já tem um modelo com esse nome.");
          else toast.error("Não foi possível salvar o modelo.");
          return;
        }
        qc.invalidateQueries({ queryKey: ["presets"] });
        qc.invalidateQueries({ queryKey: ["modelos"] });
      }
      let pecaId: string | undefined;
      if (peca && info) {
        const { data, error } = await supabase.from("pecas").insert({
          nome: peca.nome.trim().slice(0, 120),
          observacao: peca.obs.trim() ? peca.obs.trim().slice(0, 1000) : null,
          arquivo_original_path: info.tOrig != null ? original : null,
          arquivo_otimizado_path: info.tOtim != null ? otimizado : null,
          nome_arquivo_original: info.tOrig != null ? nomes.original : null,
          nome_arquivo_otimizado: info.tOtim != null ? nomes.otimizado : null,
          job_id: job.id,
        }).select("id").single();
        if (error) { toast.error("Não foi possível guardar na biblioteca."); return; }
        pecaId = data.id;
        qc.invalidateQueries({ queryKey: ["biblioteca"] });
        qc.invalidateQueries({ queryKey: ["biblioteca_info", job.id] });
      }
      setOpen(false);
      navigate({ to: "/app/biblioteca", search: { pagina: 0, q: "", ...(pecaId ? { destaque: pecaId } : {}) } });
    } finally {
      setSalvando(false);
    }
  }

  function decidirBiblioteca(g: boolean) {
    const escolha = g ? { nome: nomePeca, obs } : null;
    setGuardar(escolha);
    if (passos.includes("modelo")) setPasso("modelo");
    else void concluir(escolha, false);
  }

  const fil = o.filamento;
  const resumo: [string, string][] = [
    ["Impressora", o.impressora ? impressoraSemBico(o.impressora) : "—"],
    ["Bico", o.bico ? `${o.bico} mm` : "—"],
    ["Filamento", [fil?.tipo, materialTexto(fil?.marca ?? "", fil?.linha ?? "")].filter(Boolean).join(" · ") || "—"],
    ["Finalidade", o.finalidades?.join(", ") || "—"],
    ["Prioridades", o.prioridades?.map((p, i) => `${i + 1}º ${p}`).join(", ") || "—"],
    ["Pasta", o.pasta_saida ?? "padrão do computador"],
  ];
  const n = atual ? passos.indexOf(atual) + 1 : 0;

  return (
    <Dialog open={open} onOpenChange={(v) => !salvando && setOpen(v)}>
      <DialogTrigger asChild>
        <Button size="sm"><Check className="size-4" aria-hidden />Fechar</Button>
      </DialogTrigger>
      <DialogContent className="glass">
        {passos.length > 1 && atual && <p className="text-xs font-semibold text-muted-foreground">Passo {n} de {passos.length}</p>}
        {!info ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Carregando…</p>
        ) : atual === "biblioteca" ? (
          <>
            <DialogHeader>
              <DialogTitle>Guardar esta peça na Biblioteca?</DialogTitle>
              <DialogDescription>Você pode reimprimir ou reanalisar depois.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="flex items-center gap-3 rounded-xl bg-muted p-3">
                <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-card"><Box className="size-6 text-primary-ink" aria-hidden /></span>
                <div className="min-w-0 text-sm">
                  <p className="break-words font-semibold">{nomePecaExibicao(job.nome_peca)}</p>
                  <p className="text-muted-foreground">Original{info.tOrig == null ? " (não disponível)" : ""} e otimizado{info.tOtim == null ? " (não disponível)" : ""}</p>
                  {nomes.otimizado && <p className="break-all text-xs text-muted-foreground">Otimizado: {nomes.otimizado}</p>}
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="fechar-nome">Nome</Label>
                <Input id="fechar-nome" value={nomePeca} maxLength={120} onChange={(e) => setNomePeca(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="fechar-obs">Observação (opcional)</Label>
                <Textarea id="fechar-obs" value={obs} maxLength={1000} onChange={(e) => setObs(e.target.value)} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" disabled={salvando} onClick={() => decidirBiblioteca(false)}>Não guardar</Button>
              <Button disabled={salvando || !nomePeca.trim()} onClick={() => decidirBiblioteca(true)}>{salvando ? "Salvando…" : "Guardar na biblioteca"}</Button>
            </DialogFooter>
          </>
        ) : atual === "modelo" ? (
          <>
            <DialogHeader>
              <DialogTitle>Salvar estas configurações como modelo?</DialogTitle>
              <DialogDescription>Use de novo em Nova análise → Usar um modelo.</DialogDescription>
            </DialogHeader>
            {info.jaSalva && (
              <p className="flex items-center gap-2 rounded-xl border border-success/40 bg-success/10 p-3 text-sm text-success" role="status">
                <CheckCircle2 className="size-4" aria-hidden />Esta peça já está na biblioteca
              </p>
            )}
            <div className="space-y-4">
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 rounded-xl bg-muted p-3 text-sm">
                {resumo.map(([k, v]) => (<div key={k} className="contents"><dt className="text-muted-foreground">{k}</dt><dd className="break-words">{v}</dd></div>))}
              </dl>
              {ajustes.length > 0 && (
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-sm font-medium">
                    <Checkbox checked={incluir} onCheckedChange={(v) => setIncluir(v === true)} />
                    Incluir as mudanças aprovadas
                  </label>
                  <ul className="list-disc space-y-0.5 pl-9 text-sm text-muted-foreground">{ajustes.map((a) => <li key={a.titulo}>{a.titulo}</li>)}</ul>
                </div>
              )}
              <div className="space-y-1.5">
                <Label htmlFor="fechar-modelo">Nome do modelo</Label>
                <Input id="fechar-modelo" value={nomeModelo} maxLength={80} aria-invalid={!!erroNome} onChange={(e) => { setNomeModelo(e.target.value); setErroNome(null); }} />
                {erroNome && <p className="text-xs text-destructive" role="alert">{erroNome}</p>}
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" disabled={salvando} onClick={() => void concluir(guardar, false)}>Agora não</Button>
              <Button disabled={salvando} onClick={() => void concluir(guardar, true)}>{salvando ? "Salvando…" : "Salvar modelo"}</Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader><DialogTitle>Tudo certo</DialogTitle></DialogHeader>
            <p className="flex items-center gap-2 rounded-xl border border-success/40 bg-success/10 p-3 text-sm text-success" role="status">
              <CheckCircle2 className="size-4" aria-hidden />Esta peça já está na biblioteca
            </p>
            <DialogFooter><Button onClick={() => void concluir(null, false)}>Ir para a biblioteca</Button></DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
