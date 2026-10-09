import { Info } from "lucide-react";
import type { ComponentProps } from "react";
import { avisoPecaAberta, separarVersaoPecaAberta } from "@/lib/peca-aberta";
import { cn } from "@/lib/utils";

export interface PecaAbertaAvisoProps extends ComponentProps<"div"> {
  usarAberta: boolean;
  fatiador?: string | null;
  sistema?: string | null | undefined;
}

export function PecaAbertaAviso({ usarAberta, fatiador, sistema, className, ...props }: PecaAbertaAvisoProps) {
  const aviso = avisoPecaAberta(usarAberta, fatiador, sistema);
  if (!aviso) return null;
  return (
    <div {...props} role="status" className={cn("flex items-start gap-3 rounded-xl border border-primary/20 bg-primary/8 p-4 backdrop-blur-md", className)}>
      <Info className="mt-0.5 size-5 shrink-0 text-primary-ink" aria-hidden />
      <div className="min-w-0 space-y-1 text-sm">
        <p className="font-semibold text-primary-ink">Deixe a peça aberta e salva no {aviso.fatiador}</p>
        <p>A FatiaProAI analisa o projeto que está aberto agora no fatiador. Se você mexeu na peça, salve antes ({aviso.atalho}) para analisar a versão mais recente.</p>
      </div>
    </div>
  );
}

export interface PecaAbertaEventoProps {
  texto: string;
}

export function PecaAbertaEvento({ texto }: PecaAbertaEventoProps) {
  const partes = separarVersaoPecaAberta(texto);
  if (!partes) return <>{texto}</>;
  return <span>{partes.antes}<strong>{partes.versao}</strong>{partes.depois}</span>;
}