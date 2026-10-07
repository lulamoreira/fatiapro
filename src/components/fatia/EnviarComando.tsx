import { useEffect, useRef, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { Button, type buttonVariants } from "@/components/ui/button";
import type { VariantProps } from "class-variance-authority";

export type TipoComando = "instalar_claude_code" | "entrar_claude" | "configurar_api" | "escolher_pasta" | "adicionar_fatiador";

export interface EnviarComandoProps {
  deviceId: string;
  tipo: TipoComando;
  parametros?: Record<string, Json>;
  conectado: boolean;
  disabled?: boolean;
  children: ReactNode;
  variant?: VariantProps<typeof buttonVariants>["variant"];
  size?: VariantProps<typeof buttonVariants>["size"];
  /** Called once when the command finishes successfully. */
  onConcluido?: (resposta: Record<string, unknown>) => void;
}

export interface ComandoAoVivo {
  id: string;
  estado: string;
  resposta: Record<string, unknown>;
}

/** Sends a device_command and follows its state live (Realtime + polling fallback). */
export function useComando(deviceId: string, tipo: TipoComando, parametros: Record<string, Json> = {}, onConcluido?: (r: Record<string, unknown>) => void) {
  const qc = useQueryClient();
  const [cmdId, setCmdId] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const avisado = useRef<string | null>(null);

  const { data: raw } = useQuery({
    queryKey: ["device_command", cmdId],
    enabled: !!cmdId,
    refetchInterval: (q) => (q.state.data && ["concluido", "erro"].includes(q.state.data.estado) ? false : 4_000),
    queryFn: async () => {
      const { data, error } = await supabase.from("device_commands").select("id, estado, resposta").eq("id", cmdId!).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (!cmdId) return undefined;
    const ch = supabase
      .channel(`cmd-${cmdId}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "device_commands", filter: `id=eq.${cmdId}` }, () => qc.invalidateQueries({ queryKey: ["device_command", cmdId] }))
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [cmdId, qc]);

  const cmd: ComandoAoVivo | null = raw
    ? { id: raw.id, estado: raw.estado, resposta: raw.resposta && typeof raw.resposta === "object" && !Array.isArray(raw.resposta) ? (raw.resposta as Record<string, unknown>) : {} }
    : null;

  useEffect(() => {
    if (cmd?.estado === "concluido" && avisado.current !== cmd.id) {
      avisado.current = cmd.id;
      onConcluido?.(cmd.resposta);
      qc.invalidateQueries({ queryKey: ["devices"] });
    }
  }, [cmd, onConcluido, qc]);

  async function enviar() {
    setEnviando(true);
    const { data, error } = await supabase.from("device_commands").insert({ device_id: deviceId, tipo, parametros }).select("id").single();
    setEnviando(false);
    if (error || !data) {
      toast.error("Não foi possível enviar ao computador.");
      return;
    }
    setCmdId(data.id);
  }
  const reiniciar = () => setCmdId(null);
  const ocupado = enviando || (!!cmdId && (!cmd || cmd.estado === "pendente" || cmd.estado === "executando"));
  return { cmdId, cmd, enviar, reiniciar, ocupado };
}

/** Inserts a device_command and shows its live state (Realtime). */
export function EnviarComando({ deviceId, tipo, parametros = {}, conectado, disabled, children, variant = "default", size = "sm", onConcluido }: EnviarComandoProps) {
  const { cmdId, cmd, enviar, ocupado } = useComando(deviceId, tipo, parametros, onConcluido);
  const mensagem = typeof cmd?.resposta["mensagem"] === "string" ? cmd.resposta["mensagem"] : null;


  return (
    <div className="space-y-1.5">
      <Button type="button" variant={variant} size={size} disabled={disabled || ocupado} onClick={enviar}>
        {ocupado && <Loader2 className="size-4 animate-spin" aria-hidden />}
        {children}
      </Button>
      <div aria-live="polite" className="text-xs">
        {cmdId && (!cmd || cmd.estado === "pendente") && (
          <p className="text-muted-foreground">{conectado ? "Enviado, aguardando o computador…" : "O computador vai fazer isso quando voltar."}</p>
        )}
        {cmd?.estado === "executando" && (
          <p className="flex items-center gap-1.5 text-muted-foreground"><Loader2 className="size-3.5 animate-spin" aria-hidden />{mensagem ?? "Executando no computador…"}</p>
        )}
        {cmd?.estado === "concluido" && (
          <p className="flex items-center gap-1.5 text-success-ink"><CheckCircle2 className="size-3.5" aria-hidden />{mensagem ?? "Feito."}</p>
        )}
        {cmd?.estado === "erro" && (
          <p className="text-destructive-ink">
            {mensagem ?? "Não deu certo."}{" "}
            <button type="button" className="font-semibold underline" onClick={enviar}>Tentar de novo</button>
          </p>
        )}
      </div>
    </div>
  );
}
