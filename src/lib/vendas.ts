/** Suspensão de vendas — regras puras (sem I/O). O servidor é quem decide. */

export const VENDAS_CHAVES = ["vendas_suspensas", "vendas_suspensas_mensagem", "vendas_suspensas_desde"] as const;
export const MENSAGEM_VENDAS_MAX = 500;
export const MENSAGEM_VENDAS_PADRAO =
  "As vendas de créditos estão pausadas no momento. Seus créditos e o teste grátis continuam funcionando normalmente. Avisaremos assim que as compras voltarem.";
export const ERRO_VENDAS_PAUSADAS = "As vendas estão pausadas no momento.";

export interface StatusVendas { suspensas: boolean; mensagem: string | null }
export interface ConfigVendas extends StatusVendas { desde: string | null }

type Linha = { chave: string; valor: unknown };

/** Lê as chaves de vendas; qualquer outra chave é ignorada. */
export function lerConfigVendas(linhas: readonly Linha[] | null | undefined): ConfigVendas {
  const m = new Map((linhas ?? []).map((l) => [l.chave, l.valor]));
  const suspensas = m.get("vendas_suspensas") === true;
  const msg = m.get("vendas_suspensas_mensagem");
  const desde = m.get("vendas_suspensas_desde");
  return {
    suspensas,
    mensagem: typeof msg === "string" && msg.trim() ? msg.trim().slice(0, MENSAGEM_VENDAS_MAX) : MENSAGEM_VENDAS_PADRAO,
    desde: typeof desde === "string" ? desde : null,
  };
}

/** O que o usuário comum recebe: só suspensas + mensagem (mensagem só quando suspensas). */
export function statusPublico(linhas: readonly Linha[] | null | undefined): StatusVendas {
  const c = lerConfigVendas(linhas);
  return { suspensas: c.suspensas, mensagem: c.suspensas ? c.mensagem : null };
}

/** Portão usado por criarCompra antes de criar pedido/preferência. */
export function exigirVendasAtivas(linhas: readonly Linha[] | null | undefined): void {
  if (lerConfigVendas(linhas).suspensas) throw new Error(ERRO_VENDAS_PAUSADAS);
}
