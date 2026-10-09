import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { conferirPedido } from "@/lib/compra.functions";
import { ehStandalone } from "@/lib/instalar";

/**
 * Installed app only: when the user comes back (e.g. after paying in Safari),
 * refresh balance/statement and ask the server to check the pending order.
 */
export function useRecarregarAoVoltar(pedido: string | undefined) {
  const qc = useQueryClient();
  const conferir = useServerFn(conferirPedido);
  useEffect(() => {
    if (!ehStandalone()) return;
    const onVis = async () => {
      if (document.visibilityState !== "visible") return;
      if (pedido) {
        await conferir({ data: { pedido_id: pedido } }).catch(() => null);
        qc.invalidateQueries({ queryKey: ["pedido", pedido] });
      }
      for (const k of ["meu-plano", "creditos-lotes", "creditos-extrato", "minhas-compras"]) qc.invalidateQueries({ queryKey: [k] });
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [pedido, qc, conferir]);
}
