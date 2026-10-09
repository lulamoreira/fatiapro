/**
 * criarCompra — creates a pending order and a Mercado Pago preference.
 * Price and credits come ONLY from the active package in the database.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { CompraInput, ConferirErro, conferirPedidoLogica, montarPreferencia, urlCheckout } from "./mercadopago";
import { exigirVendasAtivas } from "./vendas";

const MAX_PENDENTES_HORA = 5;

export const criarCompra = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => CompraInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin: sb } = await import("@/integrations/supabase/client.server");
    const { tokenMP } = await import("./mercadopago.server");
    const token = tokenMP();
    // Suspensão de vendas: recusa antes de criar pedido ou preferência.
    const { data: cfgVendas } = await sb.from("config_app").select("chave, valor").eq("chave", "vendas_suspensas");
    exigirVendasAtivas(cfgVendas);
    const { data: pacote } = await sb.from("pacotes").select("id, nome, creditos, preco_centavos").eq("id", data.pacote_id).eq("ativo", true).maybeSingle();
    if (!pacote) throw new Error("Pacote indisponível.");

    const umaHora = new Date(Date.now() - 3600_000).toISOString();
    const { count } = await sb.from("pedidos").select("id", { count: "exact", head: true })
      .eq("user_id", context.userId).eq("status", "pendente").gte("criado_em", umaHora);
    if ((count ?? 0) >= MAX_PENDENTES_HORA) throw new Error("Muitas tentativas de compra. Tente de novo daqui a pouco.");

    const { data: pedido, error } = await sb.from("pedidos").insert({
      user_id: context.userId, pacote_id: pacote.id, creditos: pacote.creditos, valor_centavos: pacote.preco_centavos, status: "pendente",
    }).select("id").single();
    if (error || !pedido) throw new Error("Não foi possível iniciar a compra.");

    const email = (context.claims as { email?: string }).email ?? null;
    // Name is only used to improve the Mercado Pago payment data; a failed
    // read must never block the purchase.
    const { data: perfil } = await sb.from("profiles").select("nome").eq("id", context.userId).maybeSingle();
    const nome = typeof perfil?.nome === "string" ? perfil.nome : null;
    const r = await fetch("https://api.mercadopago.com/checkout/preferences", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(montarPreferencia(pacote, pedido.id, email, new Date(), nome)),
    });
    if (!r.ok) {
      console.error("mercadopago: criar preferência falhou", r.status);
      await sb.from("pedidos").update({ status: "cancelado" }).eq("id", pedido.id);
      throw new Error("O Mercado Pago não respondeu. Tente de novo.");
    }
    const pref = (await r.json()) as { id: string; init_point?: string; sandbox_init_point?: string };
    await sb.from("pedidos").update({ mp_preference_id: pref.id }).eq("id", pedido.id);
    const url = urlCheckout(token, pref);
    if (!url) throw new Error("O Mercado Pago não respondeu. Tente de novo.");
    return { url, pedido_id: pedido.id };
  });

/** Re-checks an order on the Mercado Pago API (owner or admin only; at most once per 5 s per order). */
export const conferirPedido = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ pedido_id: z.string().uuid() }).strip().parse(d))
  .handler(async ({ data, context }) => {
    const { depsConferir } = await import("./mercadopago.server");
    try {
      return await conferirPedidoLogica(data.pedido_id, context.userId, depsConferir());
    } catch (e) {
      if (e instanceof ConferirErro) throw new Error(e.message);
      console.error("conferirPedido:", (e as Error).message);
      throw new Error("Não foi possível conferir agora.");
    }
  });
