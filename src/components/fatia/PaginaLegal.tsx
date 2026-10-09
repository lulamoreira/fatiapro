import { Link } from "@tanstack/react-router";
import type { SecaoLegal } from "@/lib/termos-texto";
import { TERMOS_DATA, TERMOS_VERSAO } from "@/lib/termos";

export interface PaginaLegalProps { titulo: string; secoes: SecaoLegal[]; prefixo: string }

export function PaginaLegal({ titulo, secoes, prefixo }: PaginaLegalProps) {
  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-3xl px-6 py-10">
        <Link to="/" className="text-xl font-bold">Fatia<span className="text-brand">Pro</span></Link>
        <h1 className="mt-8 text-3xl font-bold">{titulo}</h1>
        <nav aria-label="Sumário" className="mt-6 rounded-2xl border bg-card p-5">
          <p className="mb-2 text-sm font-semibold">Sumário</p>
          <ol className="grid gap-1 text-sm sm:grid-cols-2">
            {secoes.map((s) => (
              <li key={s.n}><a href={`#${prefixo}-${s.n}`} className="text-primary-ink hover:underline">{s.n}. {s.titulo}</a></li>
            ))}
          </ol>
        </nav>
        <div className="mt-8 space-y-6">
          {secoes.map((s) => (
            <section key={s.n} id={`${prefixo}-${s.n}`} className="scroll-mt-6">
              <h2 className="text-lg font-semibold">{s.n}. {s.titulo}.</h2>
              <p className="mt-1 leading-relaxed text-muted-foreground">{s.texto}</p>
            </section>
          ))}
        </div>
        <footer className="mt-12 flex flex-wrap items-center justify-between gap-3 border-t pt-6 text-sm text-muted-foreground">
          <span>Versão {TERMOS_VERSAO} — {TERMOS_DATA}</span>
          <LinksLegais />
        </footer>
      </div>
    </main>
  );
}

export function LinksLegais({ novaAba = false, className }: { novaAba?: boolean; className?: string }) {
  const alvo = novaAba ? { target: "_blank", rel: "noopener noreferrer" } : {};
  return (
    <span className={className ?? "flex gap-4 text-sm text-muted-foreground"}>
      <Link to="/termos" {...alvo} className="hover:underline">Termos de uso</Link>
      <Link to="/privacidade" {...alvo} className="hover:underline">Privacidade</Link>
    </span>
  );
}
