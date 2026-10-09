import { Link } from "@tanstack/react-router";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ErroAnalise } from "@/lib/plano";

/** Inline message for a criarAnalise refusal, with its action. */
export function ErroAnaliseAviso({ erro, onQuestionario }: { erro: ErroAnalise; onQuestionario?: () => void }) {
  return (
    <div role="alert" className="space-y-2 rounded-2xl bg-warning/15 p-3 text-sm text-warning-ink">
      <p className="flex items-start gap-2"><AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />{erro.mensagem}</p>
      {erro.acao === "planos" && <Button asChild size="sm" variant="outline"><Link to="/app/plano" hash="comprar">Ver planos</Link></Button>}
      {erro.acao === "questionario" && onQuestionario && <Button size="sm" variant="outline" onClick={onQuestionario}>Responder agora</Button>}
    </div>
  );
}
