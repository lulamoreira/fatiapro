import { Link } from "@tanstack/react-router";
import { CircleHelp } from "lucide-react";
import { AJUDA_DA_TELA } from "@/lib/ajuda";

export interface BotaoAjudaProps { tela: keyof typeof AJUDA_DA_TELA }

/** Small "?" (Como funciona) that opens the matching help article. */
export function BotaoAjuda({ tela }: BotaoAjudaProps) {
  return (
    <Link to="/app/ajuda" search={{ artigo: AJUDA_DA_TELA[tela] }} aria-label="Como funciona" title="Como funciona"
      className="inline-flex size-9 shrink-0 items-center justify-center rounded-full border bg-card text-muted-foreground transition-colors hover:text-primary-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
      <CircleHelp className="size-4" aria-hidden />
    </Link>
  );
}
