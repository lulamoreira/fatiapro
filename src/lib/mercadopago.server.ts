/**
 * Server-only Mercado Pago wiring. MP_ACCESS_TOKEN / MP_WEBHOOK_SECRET are read
 * from process.env inside functions only — never sent to the browser, DB or logs.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Pagamento, WebhookDeps } from "./mercadopago";

export function tokenMP(): string {
  const t = process.env["MP_ACCESS_TOKEN"];
  if (!t) throw new Error("mp_nao_configurado");
  return t;
}

export async function buscarPagamentoMP(id: string): Promise<Pagamento | null> {
  const r = await fetch(`https://api.mercadopago.com/v1/payments/${encodeURIComponent(id)}`, { headers: { Authorization: `Bearer ${tokenMP()}` } });
  if (!r.ok) { console.error("mercadopago: consulta do pagamento falhou", r.status); return null; }
  return (await r.json()) as Pagamento;
}

export function depsWebhook(): WebhookDeps {
  return {
    secret: process.env["MP_WEBHOOK_SECRET"] ?? "",
    buscarPagamento: buscarPagamentoMP,
    async buscarPedido(id) {
      if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
      const { data } = await supabaseAdmin.from("pedidos").select("id, status, valor_centavos").eq("id", id).maybeSingle();
      return data;
    },
    async creditar(pedidoId, paymentId, metodo) {
      const { error } = await supabaseAdmin.rpc("creditar_pedido", { p_pedido: pedidoId, p_payment_id: paymentId, p_metodo: metodo ?? "desconhecido" });
      if (error) throw new Error("creditar_falhou: " + error.message);
    },
    async estornar(pedidoId, motivo) {
      const { error } = await supabaseAdmin.rpc("estornar_pedido", { p_pedido: pedidoId, p_motivo: motivo });
      if (error) throw new Error("estornar_falhou: " + error.message);
    },
    async marcarSePendente(pedidoId, status, paymentId) {
      await supabaseAdmin.from("pedidos").update({ status, mp_payment_id: paymentId }).eq("id", pedidoId).eq("status", "pendente");
    },
    async registrarEvento(e) {
      await supabaseAdmin.from("mp_eventos").insert(e);
    },
  };
}
