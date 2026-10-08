import { useEffect, useState, type ReactNode } from "react";
import { AlertTriangle, CheckCircle2, Circle, ExternalLink, Loader2, PartyPopper, ShieldCheck } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useComando } from "@/components/fatia/EnviarComando";
import { cn } from "@/lib/utils";

const TOTAL = 4;
const chave = (deviceId: string) => `fatiapro-wizard-api-${deviceId}`;

/** Bridge progress keys reported in device_commands.resposta.etapa. */
const ETAPAS = [
  { id: "janela_aberta", texto: "Janela aberta no computador" },
  { id: "testando", texto: "Testando a chave… (conferindo se é válida e se tem créditos)" },
  { id: "pronto", texto: "Pronto para analisar" },
] as const;

const MOTIVOS: Record<string, { texto: string; voltar?: number }> = {
  cancelado: { texto: "Você fechou a janela sem colar. Tente de novo." },
  chave_invalida: { texto: "Essa chave não funcionou. Confira se copiou inteira (começa com sk-ant-).", voltar: 3 },
  sem_creditos: { texto: "A chave funciona, mas a conta está sem créditos.", voltar: 2 },
  tempo_esgotado: { texto: "A janela ficou aberta sem resposta. Ela pode ter aparecido atrás de outra janela; tente de novo." },
};

const Link = ({ href, children, primary }: { href: string; children: ReactNode; primary?: boolean }) => (
  <Button asChild variant={primary ? "outline" : "link"} size="sm" className={cn(!primary && "h-auto px-0")}>
    <a href={href} target="_blank" rel="noopener noreferrer">{children}<ExternalLink className="size-3.5" aria-hidden /></a>
  </Button>
);

const Lista = ({ itens }: { itens: ReactNode[] }) => (
  <ol className="space-y-2">
    {itens.map((t, i) => (
      <li key={i} className="flex gap-3 text-sm">
        <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-bold text-primary-ink">{i + 1}</span>
        <span className="pt-0.5">{t}</span>
      </li>
    ))}
  </ol>
);

export interface ApiKeyWizardProps {
  deviceId: string;
  conectado: boolean;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

/** 4-step guide to create an Anthropic API key and paste it on the computer (never through this site). */
export function ApiKeyWizard({ deviceId, conectado, open, onOpenChange }: ApiKeyWizardProps) {
  const [passo, setPasso] = useState(1);
  const { cmd, cmdId, enviar, reiniciar, ocupado } = useComando(deviceId, "configurar_api");

  // Resume where the user stopped.
  useEffect(() => {
    if (!open) return;
    const v = Number(window.localStorage.getItem(chave(deviceId)));
    if (v >= 1 && v <= TOTAL) setPasso(v);
  }, [open, deviceId]);
  useEffect(() => { window.localStorage.setItem(chave(deviceId), String(passo)); }, [passo, deviceId]);

  const r = cmd?.resposta ?? {};
  const etapa = typeof r["etapa"] === "string" ? (r["etapa"] as string) : null;
  const concluido = cmd?.estado === "concluido" || etapa === "pronto";
  const erro = cmd?.estado === "erro";
  const motivo = erro && typeof r["motivo"] === "string" ? MOTIVOS[r["motivo"] as string] : undefined;
  const mensagem = typeof r["mensagem"] === "string" ? (r["mensagem"] as string) : null;
  const idxAtual = concluido ? ETAPAS.length : Math.max(-1, ETAPAS.findIndex((e) => e.id === etapa));

  function concluir() {
    window.localStorage.removeItem(chave(deviceId));
    setPasso(1);
    reiniciar();
    onOpenChange(false);
  }
  function tentarDeNovo() {
    reiniciar();
    if (motivo?.voltar) setPasso(motivo.voltar);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <div className="space-y-2 pr-6">
          <p className="text-xs font-semibold text-muted-foreground">Passo {passo} de {TOTAL}</p>
          <Progress value={(passo / TOTAL) * 100} aria-label={`Passo ${passo} de ${TOTAL}`} className="h-1.5" />
        </div>

        {passo === 1 && (
          <Corpo titulo="Crie sua conta na Anthropic" texto="A Anthropic é a empresa que faz o Claude. A conta de API é separada da assinatura do Claude, mesmo que você já use o claude.ai.">
            <Lista itens={["Clique em Abrir o site da Anthropic.", "Entre com seu e-mail ou Google.", "Volte para esta janela."]} />
            <Link href="https://platform.claude.com/" primary>Abrir o site da Anthropic</Link>
          </Corpo>
        )}
        {passo === 2 && (
          <Corpo titulo="Coloque créditos" texto="A API funciona com créditos pré-pagos. Uma análise costuma custar centavos; o FatiaPro mostra o custo antes de cada uma.">
            <Lista itens={["Abra Billing (Cobrança).", "Adicione créditos.", "Recomendado: em Limits, defina um limite mensal."]} />
            <div className="flex flex-wrap items-center gap-3">
              <Link href="https://platform.claude.com/settings/billing" primary>Abrir a página de cobrança</Link>
              <Link href="https://platform.claude.com/settings/limits">Definir limite mensal</Link>
            </div>
          </Corpo>
        )}
        {passo === 3 && (
          <Corpo titulo="Crie a chave">
            <Lista itens={["Abra API keys e clique em Create key.", "Dê o nome FatiaPro.", "Copie a chave (começa com sk-ant-)."]} />
            <p className="flex items-start gap-2 rounded-2xl bg-warning/15 p-3 text-sm text-warning-ink">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />O site mostra a chave uma única vez. Não feche a página antes de colar no próximo passo.
            </p>
            <Link href="https://platform.claude.com/settings/keys" primary>Abrir a página de chaves</Link>
          </Corpo>
        )}
        {passo === 4 && (
          <Corpo titulo="Cole a chave no seu computador" texto="Por segurança, a chave não passa por este site. Vai abrir uma janelinha no seu computador, na frente das outras, para você colar.">
            {!cmdId && (
              <>
                <Button size="lg" className="w-full" onClick={enviar} disabled={ocupado}>Abrir a janela no meu computador</Button>
                {!conectado && <p className="text-xs text-muted-foreground">O computador está desconectado. O pedido fica guardado e roda quando ele voltar.</p>}
              </>
            )}
            {cmdId && (
              <div aria-live="polite" className="space-y-3">
                {!etapa && !erro && !concluido && (
                  <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" aria-hidden />{conectado ? "Enviado, aguardando o computador…" : "O computador vai abrir a janela quando voltar."}</p>
                )}
                <ul className="space-y-2">
                  {ETAPAS.map((e, i) => {
                    const feito = i < idxAtual || concluido;
                    const atual = i === idxAtual && !concluido && !erro;
                    return (
                      <li key={e.id} className={cn("flex items-center gap-2 text-sm", feito ? "font-medium text-success-ink" : atual ? "font-medium" : "text-muted-foreground")}>
                        {feito ? <CheckCircle2 className="size-5 text-success" aria-hidden /> : atual ? <Loader2 className="size-5 animate-spin text-primary" aria-hidden /> : <Circle className="size-5" aria-hidden />}
                        {e.texto}
                      </li>
                    );
                  })}
                </ul>
                {concluido && (
                  <div className="animate-in zoom-in-95 fade-in space-y-3 rounded-2xl bg-success/15 p-4 text-center duration-500">
                    <PartyPopper className="mx-auto size-8 text-success" aria-hidden />
                    <p className="font-semibold text-success-ink">Tudo pronto! Este computador já pode analisar com a sua chave.</p>
                    <Button className="w-full" onClick={concluir}>Concluir</Button>
                  </div>
                )}
                {erro && (
                  <div className="space-y-2 rounded-2xl bg-destructive/10 p-4 text-sm text-destructive-ink" role="alert">
                    {mensagem && <p className="font-medium">{mensagem}</p>}
                    {motivo && <p>{motivo.texto}</p>}
                    <Button variant="outline" size="sm" onClick={tentarDeNovo}>Tentar de novo</Button>
                  </div>
                )}
              </div>
            )}
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><ShieldCheck className="size-4 text-success" aria-hidden />A chave fica guardada só no seu computador.</p>
          </Corpo>
        )}

        <div className="flex items-center justify-between gap-3 pt-2">
          <Button variant="ghost" onClick={() => setPasso((p) => Math.max(1, p - 1))} disabled={passo === 1}>Voltar</Button>
          {passo < TOTAL && (
            <Button variant="outline" onClick={() => setPasso((p) => Math.min(TOTAL, p + 1))}>{passo === 1 ? "Já tenho conta · Próximo" : "Próximo"}</Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Corpo({ titulo, texto, children }: { titulo: string; texto?: string; children: ReactNode }) {
  return (
    <div className="space-y-4">
      <DialogHeader>
        <DialogTitle className="text-xl">{titulo}</DialogTitle>
        {texto ? <DialogDescription>{texto}</DialogDescription> : <DialogDescription className="sr-only">{titulo}</DialogDescription>}
      </DialogHeader>
      {children}
    </div>
  );
}
