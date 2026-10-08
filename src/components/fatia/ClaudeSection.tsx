import { useState } from "react";
import { CheckCircle2, Circle, KeyRound, Sparkles } from "lucide-react";
import type { Relatorio } from "@/lib/fatia";
import { IconTile, Tag } from "@/components/fatia/Chip";
import { EnviarComando } from "@/components/fatia/EnviarComando";
import { ApiKeyWizard } from "@/components/fatia/ApiKeyWizard";
import { Button } from "@/components/ui/button";
import { useIsAdmin } from "@/hooks/use-is-admin";

export interface ClaudeSectionProps {
  deviceId: string;
  rel: Relatorio;
  conectado: boolean;
}

/** "Claude neste computador" — availability comes only from the bridge report. */
export function ClaudeSection({ deviceId, rel, conectado }: ClaudeSectionProps) {
  const isAdmin = useIsAdmin();
  const [wizard, setWizard] = useState(false);
  const det = rel.motores.assinatura_detalhe;
  const instalado = det?.instalado === true;
  const logado = det?.logado === true;
  const api = rel.motores.api;

  return (
    <section id={`claude-${deviceId}`} aria-labelledby={`claude-t-${deviceId}`} className="scroll-mt-6 space-y-3">
      <h3 id={`claude-t-${deviceId}`} className="text-[17px] font-semibold">FatiaProAI neste computador</h3>
      <div className={isAdmin ? "grid grid-cols-1 gap-3 md:grid-cols-2" : "grid grid-cols-1 gap-3"}>
        <div className="flex flex-col gap-3 rounded-2xl border bg-card p-4 shadow-sm">
          <div className="flex items-start gap-3">
            <IconTile tone="orange"><KeyRound /></IconTile>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-semibold">Sua chave de API</p>
                <Tag tone="primary">Recomendado</Tag>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">Você paga só o que usar, direto à Anthropic. Leva uns 5 minutos na primeira vez.</p>
            </div>
          </div>
          <Tag tone={api ? "success" : "warning"} className="self-start">{api ? "Configurada e testada" : "Não configurada"}</Tag>
          <div className="mt-auto flex flex-wrap items-center gap-3">
            {api
              ? <Button variant="outline" onClick={() => setWizard(true)}>Trocar a chave</Button>
              : <Button onClick={() => setWizard(true)}>Configurar passo a passo</Button>}
            <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-primary-ink underline underline-offset-2">Como criar uma chave</a>
          </div>
        </div>

        {isAdmin && (
          <div className="flex flex-col gap-3 rounded-2xl border bg-card p-4 shadow-sm">
            <div className="flex items-start gap-3">
              <IconTile tone="purple"><Sparkles /></IconTile>
              <div className="min-w-0 flex-1">
                <p className="font-semibold">Sua assinatura Claude</p>
                <Tag tone="muted" className="mt-1">Somente administrador · uso pessoal</Tag>
              </div>
            </div>
            <ol className="space-y-2.5">
              <li className="flex flex-wrap items-center gap-2 text-sm">
                {instalado ? <CheckCircle2 className="size-5 text-success" aria-hidden /> : <Circle className="size-5 text-muted-foreground" aria-hidden />}
                <span className="flex-1">Claude Code instalado{instalado && det?.versao ? ` · versão ${det.versao}` : ""}</span>
                {!instalado && <EnviarComando deviceId={deviceId} tipo="instalar_claude_code" conectado={conectado} variant="outline">Instalar</EnviarComando>}
              </li>
              <li className="flex flex-wrap items-center gap-2 text-sm">
                {logado ? <CheckCircle2 className="size-5 text-success" aria-hidden /> : <Circle className="size-5 text-muted-foreground" aria-hidden />}
                <span className="flex-1">Conta conectada</span>
                {!logado && <EnviarComando deviceId={deviceId} tipo="entrar_claude" conectado={conectado} disabled={!instalado} variant="outline">Entrar</EnviarComando>}
              </li>
            </ol>
          </div>
        )}
      </div>
      <ApiKeyWizard deviceId={deviceId} conectado={conectado} open={wizard} onOpenChange={setWizard} />
    </section>
  );
}
