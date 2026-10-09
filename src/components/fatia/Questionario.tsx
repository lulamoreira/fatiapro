import { useState } from "react";
import { nomePecaExibicao } from "@/lib/nome-peca";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Chip, Segmented } from "@/components/fatia/Chip";
import {
  MAX_COMENTARIO, payloadQuestionario,
  type FezSentido, type Imprimiu, type Problema, type RespostasQuestionario, type TempoPoupado,
} from "@/lib/plano";

const FEZ: { id: FezSentido; label: string }[] = [{ id: "sim", label: "Sim" }, { id: "em_parte", label: "Em parte" }, { id: "nao", label: "Não" }];
const IMP: { id: Imprimiu; label: string }[] = [
  { id: "sim_boa", label: "Sim, ficou boa" }, { id: "sim_problema", label: "Sim, mas deu problema" },
  { id: "ainda_nao", label: "Ainda não imprimi" }, { id: "nao_vou", label: "Não vou imprimir" },
];
const PROB: { id: Problema; label: string }[] = [
  { id: "descolou", label: "descolou da mesa" }, { id: "suporte", label: "falha no suporte" },
  { id: "acabamento", label: "acabamento ruim" }, { id: "fraca", label: "peça fraca" }, { id: "outro", label: "outro" },
];
const TEMPO: { id: TempoPoupado; label: string }[] = [
  { id: "nada", label: "Nada" }, { id: "ate_15", label: "Até 15 min" }, { id: "15_60", label: "15–60 min" }, { id: "mais_60", label: "Mais de 1 hora" },
];
const VAZIO: RespostasQuestionario = { fez_sentido: null, imprimiu: null, problemas: [], tempo_poupado: null, comentario: "" };

export interface QuestionarioProps {
  jobId: string | null;
  onOpenChange: (open: boolean) => void;
  /** Called after the answer is saved (e.g. retry creating the analysis). */
  onEnviado?: () => void;
}

export function Questionario({ jobId, onOpenChange, onEnviado }: QuestionarioProps) {
  const qc = useQueryClient();
  const [r, setR] = useState<RespostasQuestionario>(VAZIO);
  const [enviando, setEnviando] = useState(false);
  const { data: job } = useQuery({
    queryKey: ["job-resumo", jobId],
    enabled: !!jobId,
    queryFn: async () => (await supabase.from("jobs").select("nome_peca, criado_em").eq("id", jobId!).maybeSingle()).data,
  });
  const payload = jobId ? payloadQuestionario(jobId, r) : null;

  async function enviar() {
    if (!payload) return;
    setEnviando(true);
    const { error } = await supabase.from("feedback_respostas").insert(payload);
    setEnviando(false);
    if (error && error.code !== "23505") { toast.error("Não foi possível enviar. Tente de novo."); return; }
    setR(VAZIO);
    await Promise.all([qc.invalidateQueries({ queryKey: ["meu-plano"] }), qc.invalidateQueries({ queryKey: ["feedback", jobId] })]);
    onOpenChange(false);
    toast.success("Obrigado! A otimização de hoje foi liberada.");
    onEnviado?.();
  }

  return (
    <Dialog open={!!jobId} onOpenChange={onOpenChange}>
      <DialogContent className="glass max-h-[92vh] overflow-y-auto rounded-[22px] sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Como foi a sua última otimização?</DialogTitle>
          <DialogDescription>
            {job ? `${nomePecaExibicao(job.nome_peca)} · ${new Date(job.criado_em).toLocaleDateString("pt-BR")}` : "\u00a0"}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <Pergunta n={1} titulo="A sugestão fez sentido para você?">
            <Segmented label="A sugestão fez sentido" options={FEZ} value={r.fez_sentido} onChange={(v) => setR((p) => ({ ...p, fez_sentido: v }))} />
          </Pergunta>
          <Pergunta n={2} titulo="Você imprimiu a peça com as mudanças?">
            <Segmented label="Você imprimiu a peça" options={IMP} value={r.imprimiu} onChange={(v) => setR((p) => ({ ...p, imprimiu: v }))} />
            {r.imprimiu === "sim_problema" && (
              <div className="flex flex-wrap gap-2 pt-2" aria-label="Problemas">
                {PROB.map((x) => (
                  <Chip key={x.id} selected={r.problemas.includes(x.id)}
                    onClick={() => setR((p) => ({ ...p, problemas: p.problemas.includes(x.id) ? p.problemas.filter((y) => y !== x.id) : [...p.problemas, x.id] }))}>
                    {x.label}
                  </Chip>
                ))}
              </div>
            )}
          </Pergunta>
          <Pergunta n={3} titulo="Quanto tempo essa análise te poupou?">
            <Segmented label="Tempo poupado" options={TEMPO} value={r.tempo_poupado} onChange={(v) => setR((p) => ({ ...p, tempo_poupado: v }))} />
          </Pergunta>
          <Pergunta n={4} titulo="O que faltou ou poderia ser melhor? (opcional)">
            <Textarea aria-label="O que faltou ou poderia ser melhor" maxLength={MAX_COMENTARIO} rows={2} value={r.comentario}
              onChange={(e) => setR((p) => ({ ...p, comentario: e.target.value }))} />
          </Pergunta>
        </div>
        <DialogFooter className="flex-col gap-2 sm:flex-col">
          <Button size="lg" className="w-full" disabled={!payload || enviando} onClick={enviar}>{enviando ? "Enviando…" : "Enviar"}</Button>
          <p className="text-center text-xs text-muted-foreground">Leva 20 segundos e libera a otimização de hoje.</p>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Pergunta({ n, titulo, children }: { n: number; titulo: string; children: React.ReactNode }) {
  return (
    <fieldset className="space-y-1.5">
      <legend className="text-sm font-semibold">{n}. {titulo}</legend>
      {children}
    </fieldset>
  );
}
