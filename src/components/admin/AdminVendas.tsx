import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { PauseCircle } from "lucide-react";
import { toast } from "sonner";
import { adminSalvarVendas, adminVendas } from "@/lib/vendas.functions";
import { MENSAGEM_VENDAS_MAX } from "@/lib/vendas";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

const dataHora = (iso: string) => new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

/** "Vendas" card: pause/resume credit sales with a message shown to users. */
export function AdminVendas() {
  const qc = useQueryClient();
  const ler = useServerFn(adminVendas);
  const salvar = useServerFn(adminSalvarVendas);
  const q = useQuery({ queryKey: ["admin", "vendas"], queryFn: () => ler() });
  const [mensagem, setMensagem] = useState("");
  const [confirmar, setConfirmar] = useState(false);
  useEffect(() => { if (q.data) setMensagem(q.data.mensagem ?? ""); }, [q.data]);
  const m = useMutation({
    mutationFn: (suspensas: boolean) => salvar({ data: { suspensas, mensagem } }),
    onSuccess: () => {
      toast.success("Salvo");
      qc.invalidateQueries({ queryKey: ["admin", "vendas"] });
      qc.invalidateQueries({ queryKey: ["status-vendas"] });
    },
    onError: (e) => toast.error((e as Error).message || "Não foi possível salvar"),
  });
  if (!q.data) return <Skeleton className="h-40 rounded-2xl" />;
  const s = q.data.suspensas;
  const valida = mensagem.trim().length > 0 && mensagem.length <= MENSAGEM_VENDAS_MAX;
  return (
    <section aria-labelledby="vendas-t" className="space-y-4 rounded-2xl border bg-card p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="vendas-t" className="text-lg font-semibold">Vendas</h2>
        <span className={s ? "rounded-full bg-destructive/12 px-3 py-1 text-sm font-semibold text-destructive-ink" : "rounded-full bg-success/12 px-3 py-1 text-sm font-semibold text-success-ink"}>
          {s ? `Vendas suspensas${q.data.desde ? ` desde ${dataHora(q.data.desde)}` : ""}` : "Vendas ativas"}
        </span>
      </div>
      <div className="flex items-center gap-3">
        <Switch id="suspender" checked={s} disabled={m.isPending || (!s && !valida)}
          onCheckedChange={(v) => (v ? setConfirmar(true) : m.mutate(false))} />
        <Label htmlFor="suspender">Suspender vendas</Label>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="vendas-msg">Mensagem para os usuários</Label>
        <Textarea id="vendas-msg" value={mensagem} maxLength={MENSAGEM_VENDAS_MAX} rows={3} onChange={(e) => setMensagem(e.target.value)} />
        <p className="text-xs text-muted-foreground">{mensagem.length}/{MENSAGEM_VENDAS_MAX}</p>
      </div>
      <div className="space-y-1">
        <p className="text-xs font-semibold text-muted-foreground">Prévia</p>
        <div className="flex items-start gap-3 rounded-2xl border border-warning/50 bg-warning/12 p-4 text-sm">
          <PauseCircle className="mt-0.5 size-5 shrink-0" aria-hidden />
          <div><p className="font-semibold">Vendas pausadas</p><p className="whitespace-pre-line text-muted-foreground">{mensagem}</p></div>
        </div>
      </div>
      <Button variant="outline" size="sm" disabled={!valida || m.isPending || mensagem === q.data.mensagem} onClick={() => m.mutate(s)}>Salvar mensagem</Button>
      <AlertDialog open={confirmar} onOpenChange={setConfirmar}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Suspender vendas?</AlertDialogTitle>
            <AlertDialogDescription>Ninguém vai conseguir comprar créditos até você reativar. Continuar?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => m.mutate(true)}>Suspender</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
