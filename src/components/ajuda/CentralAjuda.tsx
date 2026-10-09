import { useEffect, useMemo, useState } from "react";
import { Box, FileText, History, Laptop, LifeBuoy, Rocket, Search, ShieldCheck, Smartphone, Wallet, Wand2, type LucideIcon } from "lucide-react";
import { ARTIGOS_AJUDA, CATEGORIAS_AJUDA, buscarArtigos, type IconeCategoria } from "@/lib/ajuda";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { ArtigoAjuda } from "./ArtigoAjuda";

const ICONES: Record<IconeCategoria, LucideIcon> = {
  rocket: Rocket, laptop: Laptop, smartphone: Smartphone, wand: Wand2, wallet: Wallet, file: FileText, history: History, lifebuoy: LifeBuoy, shield: ShieldCheck,
};

export interface CentralAjudaProps { artigoInicial?: string }

/** Help center body: search, category cards and articles (shared by /app/ajuda and /ajuda). */
export function CentralAjuda({ artigoInicial }: CentralAjudaProps) {
  const [termo, setTermo] = useState("");
  const [categoria, setCategoria] = useState<string | null>(null);
  const [abertos, setAbertos] = useState<Set<string>>(() => new Set(artigoInicial ? [artigoInicial] : []));
  const [rolarPara, setRolarPara] = useState<string | null>(artigoInicial ?? null);

  useEffect(() => {
    if (!rolarPara) return;
    document.getElementById(`artigo-${rolarPara}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
    setRolarPara(null);
  }, [rolarPara]);

  const lista = useMemo(() => {
    const achados = buscarArtigos(termo);
    return termo.trim() || !categoria ? achados : achados.filter((a) => a.categoria === categoria);
  }, [termo, categoria]);

  const alternar = (slug: string) => setAbertos((s) => { const n = new Set(s); if (n.has(slug)) n.delete(slug); else n.add(slug); return n; });
  const abrir = (slug: string) => { setTermo(""); setCategoria(null); setAbertos((s) => new Set(s).add(slug)); setRolarPara(slug); };

  return (
    <div className="space-y-6">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input type="search" value={termo} onChange={(e) => setTermo(e.target.value)} placeholder="Buscar na ajuda (ex.: crédito, ponte, orçamento)" aria-label="Buscar na ajuda" className="h-12 pl-9 text-base" />
      </div>
      {!termo.trim() && (
        <ul className="grid grid-cols-2 gap-2 md:grid-cols-3" aria-label="Categorias">
          {CATEGORIAS_AJUDA.map((c) => {
            const Icone = ICONES[c.icone] ?? Box;
            const ativo = categoria === c.id;
            return (
              <li key={c.id}>
                <button type="button" aria-pressed={ativo} onClick={() => setCategoria(ativo ? null : c.id)}
                  className={cn("flex w-full items-center gap-3 rounded-2xl border bg-card p-3 text-left text-sm font-semibold transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", ativo && "border-primary bg-primary/8")}>
                  <Icone className="size-5 shrink-0 text-primary-ink" aria-hidden />{c.titulo}
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {lista.length === 0 ? (
        <p className="rounded-2xl border bg-card p-6 text-center text-sm text-muted-foreground">Nada encontrado para "{termo}". Tente outra palavra.</p>
      ) : (
        <div className="space-y-6">
          {CATEGORIAS_AJUDA.filter((c) => lista.some((a) => a.categoria === c.id)).map((c) => (
            <section key={c.id} aria-labelledby={`cat-${c.id}`} className="space-y-2">
              <h2 id={`cat-${c.id}`} className="text-lg font-semibold">{c.titulo}</h2>
              {lista.filter((a) => a.categoria === c.id).map((a) => (
                <ArtigoAjuda key={a.slug} artigo={a} aberto={abertos.has(a.slug)} onAlternar={() => alternar(a.slug)} onAbrirRelacionado={abrir} />
              ))}
            </section>
          ))}
        </div>
      )}
      <p className="text-center text-xs text-muted-foreground">{ARTIGOS_AJUDA.length} artigos</p>
    </div>
  );
}
