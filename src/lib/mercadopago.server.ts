/**
 * Server-only Mercado Pago wiring. MP_ACCESS_TOKEN / MP_WEBHOOK_SECRET are read
 * from process.env inside functions only — never sent to the browser, DB or logs.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { ConferirDeps, Pagamento, PagamentoDeps, WebhookDeps } from "./mercadopago";

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

export function depsPagamento(): PagamentoDeps {
  return {
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
  };
}

export function depsWebhook(): WebhookDeps {
  return {
    ...depsPagamento(),
    secret: process.env["MP_WEBHOOK_SECRET"] ?? "",
    async registrarEvento(e) {
      await supabaseAdmin.from("mp_eventos").insert(e);
    },
  };
}

export function depsConferir(): ConferirDeps {
  return {
    ...depsPagamento(),
    async donoDoPedido(id) {
      const { data } = await supabaseAdmin.from("pedidos").select("user_id").eq("id", id).maybeSingle();
      return data?.user_id ?? null;
    },
    async ehAdmin(userId) {
      const { data } = await supabaseAdmin.from("app_admins").select("user_id").eq("user_id", userId).maybeSingle();
      return !!data;
    },
    async reservarConferencia(id) {
      const limite = new Date(Date.now() - 5000).toISOString();
      const { data } = await supabaseAdmin.from("pedidos").update({ conferido_em: new Date().toISOString() })
        .eq("id", id).or(`conferido_em.is.null,conferido_em.lt.${limite}`).select("id");
      return !!data?.length;
    },
    async pagamentosDoPedido(id) {
      const url = `https://api.mercadopago.com/v1/payments/search?external_reference=${encodeURIComponent(id)}&sort=date_created&criteria=desc&limit=5`;
      const r = await fetch(url, { headers: { Authorization: `Bearer ${tokenMP()}` } });
      if (!r.ok) { console.error("mercadopago: busca de pagamentos falhou", r.status); return []; }
      const j = (await r.json()) as { results?: Pagamento[] };
      return j.results ?? [];
    },
    async statusPedido(id) {
      const { data } = await supabaseAdmin.from("pedidos").select("status").eq("id", id).maybeSingle();
      return data?.status ?? "pendente";
    },
  };
}
