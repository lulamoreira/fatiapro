import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { adminMpConfig, adminSalvarMpConfig } from "@/lib/admin-pacotes.functions";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

/** mp_exigir_assinatura switch (saves on toggle, audited on the server). */
export function AssinaturaObrigatoria() {
  const qc = useQueryClient();
  const ler = useServerFn(adminMpConfig);
  const salvar = useServerFn(adminSalvarMpConfig);
  const q = useQuery({ queryKey: ["admin", "mp-config"], queryFn: () => ler() });
  const m = useMutation({
    mutationFn: (v: boolean) => salvar({ data: { exigir_assinatura: v } }),
    onSuccess: () => { toast.success("Salvo."); qc.invalidateQueries({ queryKey: ["admin", "mp-config"] }); },
    onError: (e) => toast.error((e as Error).message),
  });
  return (
    <div className="space-y-1 border-t pt-3">
      <div className="flex items-center gap-3">
        <Switch id="mp-assinatura" checked={q.data?.exigir_assinatura === true} disabled={!q.data || m.isPending} onCheckedChange={(v) => m.mutate(v)} />
        <Label htmlFor="mp-assinatura">Exigir assinatura válida nos avisos do Mercado Pago</Label>
      </div>
      <p className="text-xs text-muted-foreground">Ligue depois que o primeiro pagamento real chegar com assinatura válida.</p>
    </div>
  );
}
