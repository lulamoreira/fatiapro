import { FolderOpen, Copy, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export type AcaoArquivo = "abrir_pasta" | "abrir_no_fatiador";

export interface ArquivoCardProps {
  arquivoLocal: string;
  pastaLocal: string | null;
  confirmacao: string | null;
  disabled: boolean;
  onAcao: (a: AcaoArquivo) => void;
}

/** Shows where the bridge saved the optimized file; actions are executed by the bridge. */
export function ArquivoCard({ arquivoLocal, pastaLocal, confirmacao, disabled, onAcao }: ArquivoCardProps) {
  const nome = arquivoLocal.split(/[\\/]/).pop() ?? arquivoLocal;
  const pasta = pastaLocal ?? arquivoLocal.slice(0, Math.max(0, arquivoLocal.length - nome.length - 1));

  async function copiar() {
    try {
      await navigator.clipboard.writeText(arquivoLocal);
      toast.success("Caminho copiado");
    } catch {
      toast.error("Não foi possível copiar.");
    }
  }

  return (
    <section aria-label="Arquivo otimizado" className="rounded-2xl border bg-card p-5">
      <p className="text-sm font-semibold">Arquivo otimizado salvo no seu computador</p>
      <p className="mt-2 break-all font-display text-lg font-bold">{nome}</p>
      <p className="mt-1 whitespace-pre-wrap break-all font-mono text-xs text-muted-foreground">{pasta}</p>
      {confirmacao && (
        <p className="mt-3 flex items-center gap-2 text-sm font-medium text-success"><CheckCircle2 className="size-4" aria-hidden />{confirmacao}</p>
      )}
      <div className="mt-4 flex flex-wrap gap-2">
        <Button disabled={disabled} onClick={() => onAcao("abrir_pasta")}><FolderOpen className="size-4" />Abrir pasta</Button>
        <Button variant="outline" disabled={disabled} onClick={() => onAcao("abrir_no_fatiador")}>Abrir no fatiador</Button>
        <Button variant="ghost" onClick={copiar}><Copy className="size-4" />Copiar caminho</Button>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">O navegador não abre pastas do seu computador; quem abre é a ponte FatiaPro.</p>
    </section>
  );
}

export function avisoAcao(conectado: boolean): string {
  return conectado ? "Pedido enviado. A pasta vai abrir no seu computador." : "O computador está desconectado. A pasta abre quando ele voltar.";
}

export function arquivoDoResultado(resultado: unknown): { arquivoLocal: string; pastaLocal: string | null } | null {
  const r = (resultado ?? null) as { arquivo_local?: unknown; pasta_local?: unknown } | null;
  if (!r || typeof r.arquivo_local !== "string" || !r.arquivo_local) return null;
  return { arquivoLocal: r.arquivo_local, pastaLocal: typeof r.pasta_local === "string" ? r.pasta_local : null };
}
