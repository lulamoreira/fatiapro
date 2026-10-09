import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { TERMOS_VERSAO, precisaAceitarTermos } from "@/lib/termos";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

/** Texto da caixa com os dois links (abrem em nova aba). */
export function TextoAceite() {
  return (
    <>Li e aceito os <Link to="/termos" target="_blank" rel="noopener noreferrer" className="font-medium text-primary-ink underline">Termos de uso</Link> e a <Link to="/privacidade" target="_blank" rel="noopener noreferrer" className="font-medium text-primary-ink underline">Política de privacidade</Link></>
  );
}

/** Modal bloqueante para quem ainda não aceitou a versão atual. */
export function AceiteTermosModal() {
  const qc = useQueryClient();
  const [ok, setOk] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const { data } = useQuery({
    queryKey: ["termos-aceite"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return null;
      const { data: p, error } = await supabase.from("profiles").select("termos_versao").eq("id", u.user.id).maybeSingle();
      if (error) throw error;
      return { versao: p?.termos_versao ?? null };
    },
  });
  const aberto = !!data && precisaAceitarTermos(data.versao);

  async function aceitar() {
    setSalvando(true);
    const { error } = await supabase.rpc("aceitar_termos", { p_versao: TERMOS_VERSAO });
    setSalvando(false);
    if (error) { toast.error("Não foi possível registrar o aceite. Tente de novo."); return; }
    qc.setQueryData(["termos-aceite"], { versao: TERMOS_VERSAO });
  }

  return (
    <Dialog open={aberto}>
      <DialogContent className="[&>button]:hidden" onEscapeKeyDown={(e) => e.preventDefault()} onPointerDownOutside={(e) => e.preventDefault()} onInteractOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>Termos de uso e privacidade</DialogTitle>
          <DialogDescription>Para continuar usando o FatiaPro, leia e aceite a versão {TERMOS_VERSAO}.</DialogDescription>
        </DialogHeader>
        <label className="flex items-start gap-3 text-sm">
          <Checkbox checked={ok} onCheckedChange={(v) => setOk(v === true)} className="mt-0.5" />
          <span><TextoAceite /></span>
        </label>
        {/* O botão fica dentro de um <div> para não ser alcançado pelo seletor
            [&>button]:hidden, que só serve para esconder o X do Dialog. */}
        <div className="flex justify-end">
          <Button onClick={aceitar} disabled={!ok || salvando}>{salvando ? "Salvando…" : "Continuar"}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
