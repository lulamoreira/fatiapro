import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { adminAcao, adminUsuario } from "@/lib/admin.functions";
import { SITUACAO, relativo, situacaoUsuario } from "@/lib/admin";
import { ESTADOS, formatUSD, isConectado, roteiroLabel, fatiadorLabel, type Estado } from "@/lib/fatia";
import { Dot, Tag } from "@/components/fatia/Chip";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Avatar } from "./AdminUsuarios";

type Acao = "bloquear" | "desbloquear" | "tornar_admin" | "remover_admin";
const TEXTOS: Record<Acao, { titulo: string; texto: string; ok: string }> = {
  bloquear: { titulo: "Bloquear acesso?", texto: "A pessoa não consegue mais entrar e os computadores dela são desconectados. Dá para desfazer.", ok: "Bloquear acesso" },
  desbloquear: { titulo: "Desbloquear?", texto: "A pessoa volta a poder entrar. Os computadores continuam desconectados; ela conecta de novo com um código novo.", ok: "Desbloquear" },
  tornar_admin: { titulo: "Tornar administrador?", texto: "A pessoa passa a ver esta área, os dados de todos os usuários e a usar a assinatura Claude.", ok: "Tornar administrador" },
  remover_admin: { titulo: "Remover administrador?", texto: "A pessoa deixa de ver esta área e de usar a assinatura Claude.", ok: "Remover administrador" },
};
const SUCESSO: Record<Acao, string> = { bloquear: "Acesso bloqueado.", desbloquear: "Acesso desbloqueado.", tornar_admin: "Agora é administrador.", remover_admin: "Não é mais administrador." };

export function UsuarioPainel({ id, onClose }: { id: string | null; onClose: () => void }) {
  const fn = useServerFn(adminUsuario);
  const acaoFn = useServerFn(adminAcao);
  const qc = useQueryClient();
  const [confirmar, setConfirmar] = useState<Acao | null>(null);
  const q = useQuery({ queryKey: ["admin", "usuario", id], queryFn: () => fn({ data: { id: id! } }), enabled: !!id });
  const m = useMutation({
    mutationFn: (acao: Acao) => acaoFn({ data: { acao, alvo: id! } }),
    onSuccess: (_r, acao) => { toast.success(SUCESSO[acao]); qc.invalidateQueries({ queryKey: ["admin"] }); },
    onError: (e) => toast.error((e as Error).message || "Não foi possível concluir"),
    onSettled: () => setConfirmar(null),
  });
  const u = q.data;
  const now = Date.now();
  const sit = u ? SITUACAO[situacaoUsuario({ admin: u.admin, bloqueado: u.bloqueado, computadores: u.computadores.filter((c) => !c.revogado).length })] : null;

  return (
    <Sheet open={!!id} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="glass w-full overflow-y-auto sm:max-w-lg">
        {!u ? (
          <div className="space-y-3 pt-8">{q.isError ? <p role="alert" className="text-sm text-destructive-ink">{(q.error as Error).message}</p> : <><Skeleton className="h-16" /><Skeleton className="h-32" /><Skeleton className="h-48" /></>}</div>
        ) : (
          <div className="space-y-6">
            <SheetHeader className="text-left">
              <div className="flex items-center gap-3">
                <Avatar nome={u.nome} email={u.email} />
                <div className="min-w-0">
                  <SheetTitle className="truncate">{u.nome || "Sem nome"}</SheetTitle>
                  <SheetDescription className="truncate">{u.email}</SheetDescription>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 pt-2 text-xs text-muted-foreground">
                {sit && <Tag tone={sit.tone}>{sit.label}</Tag>}
                <span>Cadastro {new Date(u.criado_em).toLocaleDateString("pt-BR")}</span>
                <span>· Último acesso {relativo(u.ultimo_acesso)}</span>
              </div>
            </SheetHeader>

            <section aria-labelledby="pc">
              <h3 id="pc" className="mb-2 text-sm font-semibold">Computadores</h3>
              {u.computadores.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum.</p> : (
                <ul className="space-y-2">{u.computadores.map((c) => {
                  const on = !c.revogado && isConectado(c.ultimo_contato, now);
                  return (
                    <li key={c.id} className="rounded-xl bg-card p-3 text-sm shadow-sm">
                      <div className="flex items-center justify-between gap-2"><span className="font-medium">{c.nome}</span>{c.revogado ? <Tag tone="destructive">Revogado</Tag> : <span className="flex items-center gap-1.5 text-xs"><Dot on={on} />{on ? "Conectado" : "Desconectado"}</span>}</div>
                      <p className="text-xs text-muted-foreground">{c.sistema} · ponte {c.versao_ponte ?? "—"}</p>
                    </li>
                  );
                })}</ul>
              )}
            </section>

            <section aria-labelledby="gasto" className="grid grid-cols-2 gap-3">
              <h3 id="gasto" className="col-span-2 text-sm font-semibold">Gasto estimado na API</h3>
              <div className="rounded-xl bg-card p-3 shadow-sm"><p className="text-xs text-muted-foreground">Este mês</p><p className="font-bold">{formatUSD(u.gasto_api.mes)}</p></div>
              <div className="rounded-xl bg-card p-3 shadow-sm"><p className="text-xs text-muted-foreground">Total</p><p className="font-bold">{formatUSD(u.gasto_api.total)}</p></div>
            </section>

            <section aria-labelledby="an">
              <h3 id="an" className="mb-2 text-sm font-semibold">Últimas análises ({u.total_analises} no total)</h3>
              {u.analises.length === 0 ? <p className="text-sm text-muted-foreground">Nenhuma.</p> : (
                <ul className="space-y-2">{u.analises.map((j) => {
                  const e = ESTADOS[j.estado as Estado];
                  return (
                    <li key={j.id} className="rounded-xl bg-card p-3 text-sm shadow-sm">
                      <div className="flex items-center justify-between gap-2"><span className="truncate font-medium">{j.nome_peca ?? "Sem peça"}</span><Tag tone={e?.tone ?? "muted"}>{e?.label ?? j.estado}</Tag></div>
                      <p className="text-xs text-muted-foreground">{roteiroLabel(j.roteiro)} · {fatiadorLabel(j.fatiador)} · {new Date(j.criado_em).toLocaleDateString("pt-BR")} · {j.custo_usd != null ? formatUSD(j.custo_usd) : "—"}</p>
                    </li>
                  );
                })}</ul>
              )}
            </section>

            <section aria-label="Ações" className="flex flex-wrap gap-2 border-t pt-4">
              {u.bloqueado
                ? <Button variant="secondary" onClick={() => setConfirmar("desbloquear")}>Desbloquear</Button>
                : <Button variant="destructive" onClick={() => setConfirmar("bloquear")}>Bloquear acesso</Button>}
              {u.admin
                ? <Button variant="secondary" onClick={() => setConfirmar("remover_admin")}>Remover administrador</Button>
                : <Button variant="secondary" onClick={() => setConfirmar("tornar_admin")}>Tornar administrador</Button>}
            </section>
          </div>
        )}

        <AlertDialog open={!!confirmar} onOpenChange={(o) => !o && !m.isPending && setConfirmar(null)}>
          {confirmar && (
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{TEXTOS[confirmar].titulo}</AlertDialogTitle>
                <AlertDialogDescription>{TEXTOS[confirmar].texto}</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={m.isPending}>Cancelar</AlertDialogCancel>
                <AlertDialogAction disabled={m.isPending} onClick={(e) => { e.preventDefault(); m.mutate(confirmar); }}>
                  {m.isPending ? "Aguarde…" : TEXTOS[confirmar].ok}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          )}
        </AlertDialog>
      </SheetContent>
    </Sheet>
  );
}
