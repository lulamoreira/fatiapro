import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { ChevronDown, Lightbulb, ThumbsDown, ThumbsUp } from "lucide-react";
import { artigoPorSlug, type ArtigoAjuda as Artigo } from "@/lib/ajuda";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export interface ArtigoAjudaProps {
  artigo: Artigo;
  aberto: boolean;
  onAlternar: () => void;
  onAbrirRelacionado: (slug: string) => void;
}

/** Imagem com lightbox; some se não carregar. */
function ImagemAjuda({ imagem }: { imagem: NonNullable<Artigo["imagem"]> }) {
  const [erro, setErro] = useState(false);
  const [grande, setGrande] = useState(false);
  if (erro) return null;
  return (
    <figure className="max-w-[720px] space-y-1.5">
      <button type="button" onClick={() => setGrande(true)} className="block w-full overflow-hidden rounded-2xl border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label={`Ampliar: ${imagem.alt}`}>
        <img src={imagem.src} alt={imagem.alt} loading="lazy" className="w-full" onError={() => setErro(true)} />
      </button>
      <figcaption className="text-xs text-muted-foreground">{imagem.legenda}</figcaption>
      <Dialog open={grande} onOpenChange={setGrande}>
        <DialogContent className="max-w-5xl p-2">
          <DialogTitle className="sr-only">{imagem.alt}</DialogTitle>
          <img src={imagem.src} alt={imagem.alt} className="w-full rounded-xl" onClick={() => setGrande(false)} />
        </DialogContent>
      </Dialog>
    </figure>
  );
}

export function ArtigoAjuda({ artigo: a, aberto, onAlternar, onAbrirRelacionado }: ArtigoAjudaProps) {
  const [voto, setVoto] = useState<"sim" | "nao" | null>(null);
  const rel = (a.relacionados ?? []).map(artigoPorSlug).filter((x): x is Artigo => !!x);
  return (
    <article id={`artigo-${a.slug}`} className="scroll-mt-24 rounded-2xl border bg-card">
      <h3>
        <button type="button" onClick={onAlternar} aria-expanded={aberto} aria-controls={`corpo-${a.slug}`} className="flex w-full items-center justify-between gap-3 p-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-2xl">
          <span className="min-w-0"><span className="block font-semibold">{a.titulo}</span><span className="block text-sm text-muted-foreground">{a.resumo}</span></span>
          <ChevronDown className={cn("size-5 shrink-0 transition-transform", aberto && "rotate-180")} aria-hidden />
        </button>
      </h3>
      {aberto && (
        <div id={`corpo-${a.slug}`} className="space-y-4 px-4 pb-5">
          <ol className="space-y-2.5">
            {a.passos.map((p, i) => (
              <li key={p} className="flex gap-3 text-sm">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-bold text-accent-foreground">{i + 1}</span>
                <span className="pt-0.5">{p}</span>
              </li>
            ))}
          </ol>
          {a.dica && <p className="flex gap-2 rounded-xl bg-primary/8 p-3 text-sm"><Lightbulb className="mt-0.5 size-4 shrink-0 text-primary-ink" aria-hidden />{a.dica}</p>}
          {a.imagem && <ImagemAjuda imagem={a.imagem} />}
          {a.botao && <Button asChild size="sm"><Link to={a.botao.para}>{a.botao.texto}</Link></Button>}
          <div className="flex flex-wrap items-center gap-2 border-t pt-3 text-sm">
            <span className="text-muted-foreground">Isso ajudou?</span>
            <Button size="sm" variant={voto === "sim" ? "default" : "ghost"} aria-label="Sim, ajudou" aria-pressed={voto === "sim"} onClick={() => setVoto("sim")}><ThumbsUp className="size-4" /></Button>
            <Button size="sm" variant={voto === "nao" ? "default" : "ghost"} aria-label="Não ajudou" aria-pressed={voto === "nao"} onClick={() => setVoto("nao")}><ThumbsDown className="size-4" /></Button>
            {voto && <span className="text-xs text-muted-foreground">Obrigado!</span>}
          </div>
          {rel.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs font-semibold text-muted-foreground">Veja também</p>
              <ul className="flex flex-wrap gap-2">
                {rel.map((r) => <li key={r.slug}><button type="button" onClick={() => onAbrirRelacionado(r.slug)} className="rounded-full border px-3 py-1 text-xs font-medium text-primary-ink hover:bg-secondary">{r.titulo}</button></li>)}
              </ul>
            </div>
          )}
        </div>
      )}
    </article>
  );
}
