import { useEffect, useState } from "react";
import { Share, Download, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ehSafariIos, ehStandalone, gravarDispensa, lerDispensa, dispensadoRecente, mostrarDica, plataforma, type Plataforma } from "@/lib/instalar";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
}

/** Discreet top banner suggesting home-screen install on phones/tablets. Never on desktop or standalone. */
export function DicaInstalar() {
  const [p, setP] = useState<Plataforma | null>(null);
  const [visivel, setVisivel] = useState(false);
  const [evento, setEvento] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    const ua = navigator.userAgent;
    const plat = plataforma(ua, navigator.maxTouchPoints ?? 0);
    setP(plat);
    const pode = mostrarDica(plat, ehStandalone(), dispensadoRecente(lerDispensa(), Date.now()));
    if (!pode) return;
    if (plat === "ios") { if (ehSafariIos(ua)) setVisivel(true); return; }
    const onPrompt = (e: Event) => { e.preventDefault(); setEvento(e as BeforeInstallPromptEvent); setVisivel(true); };
    const onInstalled = () => setVisivel(false);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => { window.removeEventListener("beforeinstallprompt", onPrompt); window.removeEventListener("appinstalled", onInstalled); };
  }, []);

  if (!visivel || !p) return null;
  const dispensar = () => { gravarDispensa(Date.now()); setVisivel(false); };

  return (
    <div role="region" aria-label="Instalar o app" className="glass mx-4 mt-3 flex items-center gap-3 rounded-2xl px-4 py-2.5 text-sm md:hidden">
      {p === "ios" ? (
        <p className="min-w-0 flex-1"><Share className="mr-1 inline size-4 align-text-bottom text-primary-ink" aria-hidden />Use o FatiaPro como app: toque em Compartilhar e depois em 'Adicionar à Tela de Início'.</p>
      ) : (
        <div className="flex-1">
          <Button size="sm" onClick={async () => { await evento?.prompt(); setVisivel(false); }}>
            <Download className="size-4" aria-hidden />Instalar app
          </Button>
        </div>
      )}
      <Button size="sm" variant="ghost" onClick={dispensar}><X className="size-4" aria-hidden />Agora não</Button>
    </div>
  );
}
