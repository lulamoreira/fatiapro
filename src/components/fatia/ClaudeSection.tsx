import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, BadgeCheck } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Relatorio } from "@/lib/fatia";
import { Chip, Tag } from "@/components/fatia/Chip";
import { EnviarComando } from "@/components/fatia/EnviarComando";
import type { ReactNode } from "react";
import { useIsAdmin } from "@/hooks/use-is-admin";

const USOS = [
  { id: "assinatura", label: "Tenho assinatura Claude (Pro ou Max)" },
  { id: "api", label: "Tenho chave de API" },
] as const;

export interface ClaudeSectionProps {
  deviceId: string;
  usos: string[];
  rel: Relatorio;
  conectado: boolean;
}

function Etapa({ n, titulo, children }: { n: number; titulo: string; children: ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-bold">{n}</span>
      <div className="min-w-0 flex-1 space-y-1.5">
        <p className="font-medium">{titulo}</p>
        {children}
      </div>
    </li>
  );
}

const Ok = ({ children }: { children: ReactNode }) => (
  <p className="flex items-center gap-1.5 text-sm font-medium text-success"><CheckCircle2 className="size-4" aria-hidden />{children}</p>
);

/** Subscription status tag — admins only (personal use). */
export function AssinaturaTag({ disponivel }: { disponivel: boolean }) {
  const isAdmin = useIsAdmin();
  if (!isAdmin) return null;
  return <li><Tag tone={disponivel ? "success" : "muted"}>Assinatura: {disponivel ? "disponível" : "falta instalar"}</Tag></li>;
}

/** "Como este computador usa o Claude" — subscription and/or API setup via bridge commands. */
export function ClaudeSection({ deviceId, usos, rel, conectado }: ClaudeSectionProps) {
  const qc = useQueryClient();
  const salvar = useMutation({
    mutationFn: async (next: string[]) => {
      const { error } = await supabase.from("devices").update({ usos_claude: next }).eq("id", deviceId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["devices"] }),
    onError: () => toast.error("Não foi possível salvar."),
  });
  const isAdmin = useIsAdmin();
  const det = rel.motores.assinatura_detalhe;
  const instalado = det?.instalado === true;
  const logado = det?.logado === true;

  return (
    <section id={`claude-${deviceId}`} aria-label="Como este computador usa o Claude" className="mt-6 scroll-mt-6 rounded-2xl border p-5">
      <h3 className="text-sm font-semibold">Como este computador usa o Claude</h3>
      {isAdmin ? (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {USOS.map((u) => {
            const on = usos.includes(u.id);
            return (
              <span key={u.id} className="inline-flex items-center gap-1.5">
                <Chip selected={on} disabled={salvar.isPending} onClick={() => salvar.mutate(on ? usos.filter((x) => x !== u.id) : [...usos, u.id])}>
                  {u.label}
                </Chip>
                {u.id === "assinatura" && <Tag tone="muted" className="text-[11px]">Somente administrador · uso pessoal</Tag>}
              </span>
            );
          })}
        </div>
      ) : (
        <div className="mt-3 space-y-2">
          <Tag tone="primary">Chave de API</Tag>
          <p className="text-sm text-muted-foreground">
            O FatiaPro usa a sua própria chave de API da Anthropic. Você paga direto à Anthropic só o que usar, e o app mostra o custo antes de cada análise.{" "}
            <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noopener noreferrer" className="font-medium text-primary underline underline-offset-2">Como criar uma chave</a>
          </p>
        </div>
      )}

      {isAdmin && usos.includes("assinatura") && (
        <div className="mt-5 space-y-3">
          <ol className="space-y-4">
            <Etapa n={1} titulo="Instalar o Claude Code neste computador">
              {instalado ? <Ok>Instalado{det?.versao ? ` (versão ${det.versao})` : ""}</Ok> : (
                <EnviarComando deviceId={deviceId} tipo="instalar_claude_code" conectado={conectado}>Instalar</EnviarComando>
              )}
              <p className="text-xs text-muted-foreground">A ponte baixa o instalador oficial da Anthropic e confere a assinatura do arquivo antes de instalar.</p>
            </Etapa>
            <Etapa n={2} titulo="Entrar na sua conta Claude">
              {logado ? <Ok>Conta conectada</Ok> : (
                <EnviarComando deviceId={deviceId} tipo="entrar_claude" conectado={conectado} disabled={!instalado}>Entrar</EnviarComando>
              )}
              <p className="text-xs text-muted-foreground">Vai abrir uma página de login da Claude no navegador do seu computador. Confirme lá e volte aqui.</p>
            </Etapa>
          </ol>
          {instalado && logado && <Tag tone="success" className="gap-1"><BadgeCheck className="size-3.5" aria-hidden />Assinatura pronta para usar</Tag>}
        </div>
      )}

      {(!isAdmin || usos.includes("api")) && (
        <ol className="mt-5">
          <Etapa n={1} titulo="Configurar a chave de API no computador">
            {rel.motores.api ? <Ok>Chave configurada</Ok> : (
              <EnviarComando deviceId={deviceId} tipo="configurar_api" conectado={conectado}>Configurar</EnviarComando>
            )}
            <p className="text-xs text-muted-foreground">A ponte abre uma janela no computador para você colar a chave. Ela fica guardada só no computador e nunca passa pela internet do app.</p>
          </Etapa>
        </ol>
      )}
    </section>
  );
}
