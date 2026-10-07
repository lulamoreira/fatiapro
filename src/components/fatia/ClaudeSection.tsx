import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, BadgeCheck } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Relatorio } from "@/lib/fatia";
import { Chip, Tag } from "@/components/fatia/Chip";
import { EnviarComando } from "@/components/fatia/EnviarComando";
import type { ReactNode } from "react";

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
  const det = rel.motores.assinatura_detalhe;
  const instalado = det?.instalado === true;
  const logado = det?.logado === true;

  return (
    <section id={`claude-${deviceId}`} aria-label="Como este computador usa o Claude" className="mt-6 scroll-mt-6 rounded-2xl border p-5">
      <h3 className="text-sm font-semibold">Como este computador usa o Claude</h3>
      <div className="mt-3 flex flex-wrap gap-2">
        {USOS.map((u) => {
          const on = usos.includes(u.id);
          return (
            <Chip key={u.id} selected={on} disabled={salvar.isPending} onClick={() => salvar.mutate(on ? usos.filter((x) => x !== u.id) : [...usos, u.id])}>
              {u.label}
            </Chip>
          );
        })}
      </div>

      {usos.includes("assinatura") && (
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

      {usos.includes("api") && (
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
