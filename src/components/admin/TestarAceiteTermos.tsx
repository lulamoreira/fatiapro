import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

/** Only mounted in the admin area; the RPC independently validates membership. */
export function TestarAceiteTermos() {
  const qc = useQueryClient();
  const [aberto, setAberto] = useState(false);
  const [salvando, setSalvando] = useState(false);

  async function resetar() {
    if (salvando) return;
    setSalvando(true);
    try {
      const { error } = await supabase.rpc("admin_resetar_meu_aceite");
      if (error) throw error;
      setAberto(false);
      await qc.invalidateQueries({ queryKey: ["termos-aceite"] });
    } catch {
      toast.error("Não foi possível redefinir seu aceite. Tente novamente.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setAberto(true)}>
        Testar aceite dos Termos na minha conta
      </Button>
      <AlertDialog open={aberto} onOpenChange={(valor) => { if (!salvando) setAberto(valor); }}>
        <AlertDialogContent aria-busy={salvando}>
          <AlertDialogHeader>
            <AlertDialogTitle>Redefinir o aceite dos Termos na sua conta?</AlertDialogTitle>
            <AlertDialogDescription>
              Apenas o seu aceite será removido. Você precisará aceitar os Termos novamente para continuar.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button variant="outline" disabled={salvando} onClick={() => setAberto(false)}>Cancelar</Button>
            <Button disabled={salvando} onClick={resetar}>{salvando ? "Aguarde…" : "Confirmar"}</Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}