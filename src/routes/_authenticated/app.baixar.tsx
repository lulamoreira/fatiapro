import { createFileRoute } from "@tanstack/react-router";
import { BotaoAjuda } from "@/components/ajuda/BotaoAjuda";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Download, FolderOpen, KeyRound, Hash, CheckCircle2, Laptop } from "lucide-react";
import { usePonteVersoes, ultimaPublicada } from "@/hooks/use-ponte-versoes";
import { baixarPonte } from "@/lib/ponte.functions";
import { detectarSistema, PLATAFORMA_LABEL, type Plataforma } from "@/lib/ponte";
import { formatBytes } from "@/lib/storage";
import { PageHeader, IconTile } from "@/components/fatia/Chip";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_authenticated/app/baixar")({
  head: () => ({
    meta: [
      { title: "Baixar a ponte — FatiaPro" },
      { name: "description", content: "Baixe e instale a FatiaPro Ponte no seu Mac ou Windows." },
      { property: "og:title", content: "Baixar a ponte — FatiaPro" },
      { property: "og:description", content: "Baixe e instale a FatiaPro Ponte no seu Mac ou Windows." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: BaixarPage,
});

const PASSOS_MAC = [
  { icon: FolderOpen, txt: "Abra o arquivo baixado (pasta Downloads)." },
  { icon: KeyRound, txt: "Siga o instalador e digite a senha do Mac quando pedir." },
  { icon: Hash, txt: "Aparece uma janela pedindo um código: volte aqui em Configurações → \"Conectar computador\" e digite o código de 6 dígitos." },
  { icon: CheckCircle2, txt: "Se o Mac pedir permissão para a \"FatiaPro Ponte\", autorize." },
];

function BaixarPage() {
  const { data: versoes, isLoading } = usePonteVersoes();
  const [sistema, setSistema] = useState<Plataforma>("macos");
  const [baixando, setBaixando] = useState(false);
  useEffect(() => { setSistema(detectarSistema(navigator as never) ?? "macos"); }, []);
  const outro: Plataforma = sistema === "macos" ? "windows" : "macos";
  const v = ultimaPublicada(versoes, sistema);

  async function baixar() {
    setBaixando(true);
    try {
      const { url } = await baixarPonte({ data: { plataforma: sistema } });
      window.location.assign(url);
    } catch { toast.error("Não foi possível iniciar o download."); }
    finally { setBaixando(false); }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader titulo="Baixar a ponte" subtitulo="O programa que liga seu computador ao FatiaPro." acao={<BotaoAjuda tela="baixar" />} />
      <section className="rounded-3xl border bg-card p-6 text-center md:p-10">
        <IconTile tone="blue" className="mx-auto size-14 rounded-2xl [&_svg]:size-7"><Laptop /></IconTile>
        {isLoading ? <Skeleton className="mx-auto mt-6 h-12 w-56" /> : v ? (
          <>
            <Button size="lg" className="mt-6" onClick={baixar} disabled={baixando}><Download className="size-4" />Baixar para {PLATAFORMA_LABEL[sistema]}</Button>
            <p className="mt-3 text-sm text-muted-foreground tabular">Versão {v.versao} · {formatBytes(Number(v.tamanho_bytes))}</p>
          </>
        ) : <p className="mt-6 text-lg font-semibold">Em breve para {PLATAFORMA_LABEL[sistema]}</p>}
        <button type="button" onClick={() => setSistema(outro)} className="mt-4 text-xs font-medium text-primary-ink underline">
          Usa outro sistema? Ver para {PLATAFORMA_LABEL[outro]}
        </button>
      </section>
      {sistema === "macos" && (
        <section className="rounded-3xl border bg-card p-6">
          <h2 className="mb-4 text-lg font-semibold">Como instalar no Mac</h2>
          <ol className="space-y-4">
            {PASSOS_MAC.map((p, i) => (
              <li key={p.txt} className="flex gap-3">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-accent text-sm font-bold text-accent-foreground">{i + 1}</span>
                <p.icon className="mt-1.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
                <span className="text-sm">{p.txt}</span>
              </li>
            ))}
          </ol>
        </section>
      )}
      <p className="text-center text-sm text-muted-foreground">Depois de instalada, a ponte liga sozinha com o computador e se atualiza sozinha.</p>
    </div>
  );
}
