import { useState } from "react";
import { CheckCircle2, Circle, Loader2, Plus } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useComando } from "@/components/fatia/EnviarComando";
import { cn } from "@/lib/utils";

const ETAPAS = [
  { id: "escolhido", texto: "Programa escolhido" },
  { id: "compativel", texto: "Programa compatível" },
  { id: "teste", texto: "Fatiando uma peça de teste…" },
  { id: "perfis", texto: "Lendo impressoras e filamentos" },
] as const;

/** Lets the bridge register another Bambu/Orca-family slicer chosen on the computer. */
export function AdicionarFatiadorDialog({ deviceId, conectado }: { deviceId: string; conectado: boolean }) {
  const [open, setOpen] = useState(false);
  const { cmd, cmdId, enviar, reiniciar, ocupado } = useComando(deviceId, "adicionar_fatiador");
  const r = cmd?.resposta ?? {};
  const etapa = typeof r["etapa"] === "string" ? (r["etapa"] as string) : null;
  const caminho = typeof r["caminho"] === "string" ? (r["caminho"] as string) : null;
  const nome = typeof r["nome"] === "string" ? (r["nome"] as string) : "Fatiador";
  const mensagem = typeof r["mensagem"] === "string" ? (r["mensagem"] as string) : null;
  const concluido = cmd?.estado === "concluido";
  const erro = cmd?.estado === "erro";
  const idx = concluido ? ETAPAS.length : ETAPAS.findIndex((e) => e.id === etapa);

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v && (concluido || erro)) reiniciar(); }}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm"><Plus className="size-4" />Adicionar outro fatiador</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Adicionar outro fatiador</DialogTitle>
          <DialogDescription>A ponte já procura sozinha os fatiadores conhecidos. Use isto para um programa que ela não encontrou.</DialogDescription>
        </DialogHeader>
        <p className="rounded-2xl bg-muted p-3 text-sm">
          <b>Funcionam:</b> fatiadores da família Bambu/Orca, como Creality Print, Elegoo Slicer, QIDI Studio, Flashforge Orca e Bambu Studio Beta. <b>Ainda não:</b> Cura e PrusaSlicer, que usam outro sistema.
        </p>
        {!cmdId ? (
          <>
            <Button size="lg" className="w-full" onClick={enviar} disabled={ocupado}>Escolher o programa no computador</Button>
            {!conectado && <p className="text-xs text-muted-foreground">Seu computador está desconectado. O pedido roda quando ele voltar.</p>}
          </>
        ) : (
          <div aria-live="polite" className="space-y-3">
            {idx < 0 && !erro && <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" aria-hidden />Aguardando você escolher o programa no computador…</p>}
            <ul className="space-y-2">
              {ETAPAS.map((e, i) => {
                const feito = i < idx;
                const atual = i === idx && !erro;
                return (
                  <li key={e.id} className={cn("flex items-start gap-2 text-sm", feito ? "text-success-ink" : atual ? "font-medium" : "text-muted-foreground")}>
                    {feito ? <CheckCircle2 className="size-5 shrink-0 text-success" aria-hidden /> : atual ? <Loader2 className="size-5 shrink-0 animate-spin text-primary" aria-hidden /> : <Circle className="size-5 shrink-0" aria-hidden />}
                    <span className="min-w-0">{e.texto}{e.id === "escolhido" && caminho && <span className="block break-all font-mono text-xs text-muted-foreground">{caminho}</span>}</span>
                  </li>
                );
              })}
            </ul>
            {concluido && <p className="flex items-center gap-2 rounded-2xl bg-success/15 p-3 text-sm font-semibold text-success-ink"><CheckCircle2 className="size-5" aria-hidden />{nome} adicionado</p>}
            {erro && (
              <div className="space-y-2 rounded-2xl bg-destructive/10 p-3 text-sm text-destructive-ink" role="alert">
                <p>{mensagem ?? "Não foi possível adicionar este programa."}</p>
                <Button variant="outline" size="sm" onClick={reiniciar}>Tentar de novo</Button>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
