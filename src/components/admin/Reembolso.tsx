import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { adminDuplicados, adminReembolsar, adminReembolsarDuplicado } from "@/lib/admin-pacotes.functions";
import { brlCentavos } from "@/lib/mercadopago";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

const dataHora = (iso: string) => new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

export interface ConfirmarReembolsoProps {
  titulo: string;
  linhas: string[];
  pendente: boolean;
  onConfirmar: () => void;
}

/** "Reembolsar" button + in-app confirmation dialog. */
export function ConfirmarReembolso({ titulo, linhas, pendente, onConfirmar }: ConfirmarReembolsoProps) {
  const [aberto, setAberto] = useState(false);
  return (
    <>
      <Button size="sm" variant="outline" disabled={pendente} onClick={() => setAberto(true)}>{pendente ? "Reembolsando…" : "Reembolsar"}</Button>
      <AlertDialog open={aberto} onOpenChange={setAberto}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{titulo}</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-1">{linhas.map((l) => <p key={l}>{l}</p>)}</div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={onConfirmar}>Reembolsar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export interface PedidoReembolsavel { id: string; valor_centavos: number; pago_em: string | null; criado_em: string; creditos: number; restante: number | null }

export function ReembolsarPedido({ p }: { p: PedidoReembolsavel }) {
  const qc = useQueryClient();
  const fn = useServerFn(adminReembolsar);
  const m = useMutation({
    mutationFn: () => fn({ data: { pedido_id: p.id } }),
    onSuccess: () => { toast.success("Reembolso feito e créditos removidos."); qc.invalidateQueries({ queryKey: ["admin", "pedidos"] }); },
    onError: (e) => toast.error((e as Error).message),
  });
  return (
    <ConfirmarReembolso titulo="Reembolsar este pedido?" pendente={m.isPending} onConfirmar={() => m.mutate()} linhas={[
      `Valor: ${brlCentavos(p.valor_centavos)}`,
      `Pago em: ${dataHora(p.pago_em ?? p.criado_em)}`,
      `Créditos ainda restantes deste pedido: ${p.restante ?? 0} de ${p.creditos} (serão removidos).`,
      "O valor volta para quem pagou pelo Mercado Pago.",
    ]} />
  );
}

/** Yellow banner listing duplicate payments to refund (credits untouched). */
export function Duplicados() {
  const qc = useQueryClient();
  const ler = useServerFn(adminDuplicados);
  const reembolsar = useServerFn(adminReembolsarDuplicado);
  const q = useQuery({ queryKey: ["admin", "duplicados"], queryFn: () => ler() });
  const m = useMutation({
    mutationFn: (id: string) => reembolsar({ data: { id } }),
    onSuccess: () => { toast.success("Pagamento duplicado reembolsado."); qc.invalidateQueries({ queryKey: ["admin", "duplicados"] }); },
    onError: (e) => toast.error((e as Error).message),
  });
  const lista = q.data ?? [];
  if (!lista.length) return null;
  return (
    <div role="status" className="space-y-2 rounded-2xl border border-warning/50 bg-warning/12 p-4 text-sm">
      <p className="flex items-center gap-2 font-semibold"><AlertTriangle className="size-4" aria-hidden />{lista.length} {lista.length === 1 ? "pagamento em duplicidade" : "pagamentos em duplicidade"} para reembolsar</p>
      <ul className="divide-y divide-warning/30">{lista.map((d) => (
        <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
          <span>{dataHora(d.criado_em)} · pagamento {d.payment_id} · {brlCentavos(d.valor_centavos)}</span>
          <ConfirmarReembolso titulo="Reembolsar pagamento duplicado?" pendente={m.isPending && m.variables === d.id} onConfirmar={() => m.mutate(d.id)} linhas={[
            `Valor: ${brlCentavos(d.valor_centavos)}`, `Recebido em: ${dataHora(d.criado_em)}`, "Os créditos do pedido continuam com o cliente.",
          ]} />
        </li>
      ))}</ul>
    </div>
  );
}
