import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import { criarSequenciaAnimo, INICIO_ANIMO_MS, TROCA_ANIMO_MS } from "@/lib/frases-animo";

export interface FraseAnimoProps {
  ativa: boolean;
  inicioMs: number;
}

export function FraseAnimo({ ativa, inicioMs }: FraseAnimoProps) {
  const [frase, setFrase] = useState<string | null>(null);

  useEffect(() => {
    if (!ativa || !Number.isFinite(inicioMs)) return;
    const proxima = criarSequenciaAnimo();
    let troca: ReturnType<typeof setInterval> | undefined;
    const inicio = setTimeout(() => {
      setFrase(proxima());
      troca = setInterval(() => setFrase(proxima()), TROCA_ANIMO_MS);
    }, Math.max(0, inicioMs + INICIO_ANIMO_MS - Date.now()));
    return () => {
      clearTimeout(inicio);
      if (troca !== undefined) clearInterval(troca);
    };
  }, [ativa, inicioMs]);

  if (!ativa || !frase) return null;

  return (
    <div aria-live="polite" aria-atomic="true" className="text-base italic text-muted-foreground">
      <p key={frase} className="flex items-start gap-2 animate-in fade-in duration-[400ms] motion-reduce:animate-none">
        <Sparkles className="mt-1 size-4 shrink-0" aria-hidden />
        <span>{frase}</span>
      </p>
    </div>
  );
}