import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useComando } from "@/components/fatia/EnviarComando";
import { useNow } from "@/hooks/use-now";
import { isConectado } from "@/lib/fatia";
import { analiseAbertaQuery, avisoPodeVoltar, chaveDepois, guardarDepois, lerDepois, ponteNovaQuery, precisaAtualizar, temBotao, type DeviceAtualizacao } from "@/lib/atualizacao-ponte";

export interface BotaoAtualizarPonteProps { device: DeviceAtualizacao }
export function BotaoAtualizarPonte({ device }: BotaoAtualizarPonteProps) {
  const { data: versoes = [] } = useQuery(ponteNovaQuery);
  const now = useNow(10_000);
  const { cmd, ocupado, enviar } = useComando(device.id, "atualizar_ponte");
  const avisado = useRef<string | null>(null);
  const mensagem = typeof cmd?.resposta["mensagem"] === "string" ? cmd.resposta["mensagem"] : null;
  useEffect(() => {
    if (cmd?.estado === "erro" && cmd.resposta["motivo"] === "analise_aberta" && avisado.current !== cmd.id) {
      avisado.current = cmd.id;
      toast.warning(mensagem ?? "Há uma análise aberta neste computador.");
    }
  }, [cmd, mensagem]);
  const nova = precisaAtualizar(device, versoes);
  // Keep command feedback visible even if the bridge disconnects while restarting.
  if (!cmd && !ocupado && (!nova || !temBotao(device.versao_ponte) || !isConectado(device.ultimo_contato, now))) return null;
  return (
    <div className="min-w-0 max-w-full space-y-1">
      {cmd?.estado !== "concluido" && <Button type="button" size="sm" variant="outline" disabled={ocupado || !isConectado(device.ultimo_contato, now)} onClick={enviar}>
        {ocupado ? <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden /> : <Download className="size-4" aria-hidden />}
        Atualizar agora
      </Button>}
      <p aria-live="polite" className="break-words text-xs text-muted-foreground">
        {cmd?.estado === "concluido" ? "Ponte atualizada" : mensagem ?? (ocupado ? "Aguardando o computador…" : null)}
      </p>
    </div>
  );
}

export interface BotaoPonteSempreProps { device: DeviceAtualizacao }
/** Botão de atualização sempre visível quando há computador, com o estado logo abaixo. */
export function BotaoPonteSempre({ device }: BotaoPonteSempreProps) {
  const versoesQuery = useQuery(ponteNovaQuery);
  const versoes = versoesQuery.data ?? [];
  const now = useNow(10_000);
  const { cmd, ocupado, enviar } = useComando(device.id, "atualizar_ponte");
  const avisado = useRef<string | null>(null);
  const mensagem = typeof cmd?.resposta["mensagem"] === "string" ? cmd.resposta["mensagem"] : null;
  useEffect(() => {
    if (cmd?.estado === "erro" && cmd.resposta["motivo"] === "analise_aberta" && avisado.current !== cmd.id) {
      avisado.current = cmd.id;
      toast.warning(mensagem ?? "Há uma análise aberta neste computador.");
    }
  }, [cmd, mensagem]);
  const nova = precisaAtualizar(device, versoes);
  const conectado = isConectado(device.ultimo_contato, now);
  const podeBotao = temBotao(device.versao_ponte);
  // A mensagem do comando continua visível mesmo quando a ponte reinicia.
  let detalhe: string | null = null;
  if (cmd?.estado === "concluido") detalhe = mensagem ?? "Ponte atualizada";
  else if (ocupado) detalhe = mensagem ?? "Aguardando o computador…";
  else if (!conectado) detalhe = "Computador desconectado";
  else if (!podeBotao) detalhe = "Ela entra sozinha quando não houver análise aberta";
  else if (nova) detalhe = `Versão ${nova.versao} disponível`;
  else if (versoesQuery.isFetched) detalhe = "Versão mais recente";
  return (
    <div className="min-w-0 max-w-full space-y-1">
      <Button type="button" size="sm" variant={nova ? "default" : "outline"} disabled={ocupado || !conectado || !podeBotao} onClick={enviar}>
        {ocupado ? <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden /> : <Download className="size-4" aria-hidden />}
        Atualizar ponte
      </Button>
      {detalhe && <p aria-live="polite" className="break-words text-xs text-muted-foreground">{detalhe}</p>}
    </div>
  );
}

export interface AvisoPonteNovaProps { device: DeviceAtualizacao | undefined }
export function AvisoPonteNova({ device }: AvisoPonteNovaProps) {
  const { data: versoes = [] } = useQuery(ponteNovaQuery);
  const { data: abertas } = useQuery(analiseAbertaQuery(device?.id));
  const now = useNow(30_000);
  // O acompanhamento do comando fica aqui, sempre montado no layout, para continuar depois que a janela fecha.
  const { cmd, enviar } = useComando(device?.id ?? "", "atualizar_ponte");
  const avisado = useRef<string | null>(null);
  const versaoPedida = useRef<string | null>(null);
  const nova = device ? precisaAtualizar(device, versoes) : null;
  const chave = device && nova ? `${device.id}.${nova.versao}` : null;
  const [adiamento, setAdiamento] = useState<{ chave: string; data: string | null } | null>(null);
  useEffect(() => {
    if (device && nova && chave) setAdiamento({ chave, data: lerDepois(device.id, nova.versao) });
  }, [device?.id, nova?.versao, chave]);
  const mensagem = typeof cmd?.resposta["mensagem"] === "string" ? cmd.resposta["mensagem"] : null;
  // Avisos do fim do comando, uma vez por comando, mesmo com a janela já fechada.
  useEffect(() => {
    if (!cmd || avisado.current === cmd.id) return;
    if (cmd.estado !== "concluido" && cmd.estado !== "erro") return;
    avisado.current = cmd.id;
    if (cmd.estado === "concluido") {
      toast.success(`Ponte atualizada para a versão ${versaoPedida.current ?? "mais recente"}`);
      return;
    }
    // Em caso de erro, apaga a marcação para a janela poder voltar quando não houver análise aberta.
    if (device && nova) {
      try { globalThis.localStorage?.removeItem(chaveDepois(device.id, nova.versao)); }
      catch { /* A indisponibilidade do armazenamento não impede o aviso. */ }
    }
    if (cmd.resposta["motivo"] === "analise_aberta") {
      toast.warning(mensagem ?? "Há uma análise aberta neste computador. A ponte será atualizada depois.");
    } else {
      toast.error(mensagem ?? "Não foi possível atualizar a ponte.");
    }
  }, [cmd, mensagem, device?.id, nova?.versao]);
  if (!device || !nova || !chave) return null;
  const open = abertas === 0 && adiamento?.chave === chave && avisoPodeVoltar(adiamento.data, now);
  const depois = () => {
    guardarDepois(device.id, nova.versao, now);
    setAdiamento({ chave, data: String(now) });
  };
  const atualizarAgora = () => {
    versaoPedida.current = nova.versao;
    enviar();
    // Fecha na hora e marca a versão como pedida, para a janela não reabrir enquanto a ponte reinicia.
    guardarDepois(device.id, nova.versao, now);
    setAdiamento({ chave, data: String(now) });
    toast.info("Atualizando a ponte em segundo plano. Avisaremos quando terminar.");
  };
  return (
    <AlertDialog open={open} onOpenChange={(v) => { if (!v) depois(); }}>
      <AlertDialogContent className="max-w-[calc(100%-2rem)] sm:max-w-lg">
        <AlertDialogHeader>
          <AlertDialogTitle>Nova versão da ponte</AlertDialogTitle>
          <AlertDialogDescription className="break-words">A versão {nova.versao} está disponível. Você está na {device.versao_ponte}.</AlertDialogDescription>
        </AlertDialogHeader>
        {nova.notas && <p className="max-h-60 overflow-y-auto whitespace-pre-wrap break-words text-sm text-muted-foreground">{nova.notas}</p>}
        {!temBotao(device.versao_ponte) && <p className="text-sm text-muted-foreground">Ela entra sozinha quando não houver análise aberta</p>}
        <AlertDialogFooter className="gap-2">
          <Button variant="ghost" onClick={depois}>{temBotao(device.versao_ponte) ? "Depois" : "Entendi"}</Button>
          {temBotao(device.versao_ponte) && (
            <Button type="button" disabled={!isConectado(device.ultimo_contato, now)} onClick={atualizarAgora}>
              <Download className="size-4" aria-hidden />
              Atualizar agora
            </Button>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}