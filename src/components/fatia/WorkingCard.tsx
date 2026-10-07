import { forwardRef } from "react";
import { Loader2, Check, Circle, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type Fase = "na_fila" | "analisando" | "aplicando" | "outra";

const TITULOS: Record<Fase, string> = {
  na_fila: "Aguardando seu computador pegar o pedido…",
  analisando: "Analisando a peça e testando mudanças no fatiador…",
  aplicando: "Aplicando suas mudanças e fatiando de novo…",
  outra: "Testando outra opção…",
};

export interface WorkingCardProps {
  fase: Fase;
  ultimaMensagem: string | null;
  desdeMs: number;
  now: number;
  /** Only for fase "aplicando". */
  passos?: { aplicou: boolean; resultado: boolean };
  ultimoContatoMs: number | null;
  semEventosMs: number;
  onCancelar: () => void;
}

function cronometro(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${sec}` : `${m}:${sec}`;
}

export const WorkingCard = forwardRef<HTMLElement, WorkingCardProps>(function WorkingCard(
  { fase, ultimaMensagem, desdeMs, now, passos, ultimoContatoMs, semEventosMs, onCancelar },
  ref,
) {
  const sinalS = ultimoContatoMs != null ? Math.max(0, Math.floor((now - ultimoContatoMs) / 1000)) : null;
  const desconectado = sinalS == null || sinalS > 60;
  const lista = passos
    ? [
        { t: "Aprovação enviada", ok: true },
        { t: "Aplicando mudanças", ok: passos.aplicou },
        { t: "Fatiando de novo", ok: passos.resultado },
        { t: "Resultado pronto", ok: passos.resultado },
      ]
    : [];
  const atual = lista.findIndex((p) => !p.ok);

  return (
    <section ref={ref} aria-live="polite" aria-label="Trabalhando" className="scroll-mt-6 rounded-3xl border-2 border-primary/40 bg-accent/40 p-6">
      <div className="flex items-start gap-4">
        <Loader2 className="mt-1 size-7 shrink-0 animate-spin text-primary-ink" aria-hidden />
        <div className="min-w-0 flex-1">
          <h2 className="text-xl font-bold">{TITULOS[fase]}</h2>
          {ultimaMensagem && <p className="mt-1 text-sm text-muted-foreground">{ultimaMensagem}</p>}
          <p className="mt-2 text-xs font-medium text-muted-foreground tabular">há {cronometro(now - desdeMs)}</p>
        </div>
      </div>

      {lista.length > 0 && (
        <ol className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-sm">
          {lista.map((p, i) => (
            <li key={p.t} className={cn("flex items-center gap-1.5", p.ok ? "text-success" : i === atual ? "font-semibold text-foreground" : "text-muted-foreground")}>
              {p.ok ? <Check className="size-4" aria-hidden /> : i === atual ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Circle className="size-3.5" aria-hidden />}
              {p.t}
            </li>
          ))}
        </ol>
      )}

      <p className="mt-4 text-xs text-muted-foreground tabular">
        {sinalS == null ? "Ainda sem sinal do seu computador" : `Último sinal do seu computador há ${sinalS}s`}
      </p>
      {desconectado && (
        <p className="mt-2 flex items-center gap-2 rounded-xl bg-warning/25 p-3 text-sm text-warning-foreground dark:text-warning">
          <AlertTriangle className="size-4 shrink-0" aria-hidden />
          Seu computador parece desconectado. A análise continua sozinha quando ele voltar.
        </p>
      )}
      {semEventosMs > 3 * 60_000 && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border p-3 text-sm">
          <span>Está demorando mais que o normal</span>
          <Button size="sm" variant="outline" onClick={onCancelar}>Cancelar análise</Button>
        </div>
      )}
    </section>
  );
});
