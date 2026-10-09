import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatUSD } from "@/lib/fatia";
import { formatInt, formatPct, formatReais, linkAdmin, type PeriodoAdmin } from "@/lib/inicio";
import { Segmented } from "@/components/fatia/Chip";
import { Kpi, KpiSkeleton, Secao } from "./Kpi";

export interface KpisAdmin {
  fila_parada: number; mp_problemas: number; pedidos_pendentes_1h: number; ponte_desatualizada: number;
  usuarios_total: number; usuarios_novos: number; usuarios_ativos: number; em_teste: number; pagantes: number; bloqueados: number;
  computadores_conectados: number; computadores_total: number; sem_computador: number;
  analises: number; concluidas: number; erros: number; por_roteiro: Record<"config_geral" | "reduzir_tempo" | "checklist" | "preco", number>;
  receita_bruta: number; receita_liquida: number; pedidos_aprovados: number; custo_ia_usd: number; margem_brl: number;
  creditos_vendidos: number; creditos_consumidos: number; creditos_circulacao: number; creditos_vencendo_30d: number;
  cupons_resgatados: number; feedback_total: number; feedback_sentido: number; feedback_imprimiu: number; feedback_boa: number;
  orcamentos: number; orcamentos_aprovados: number; orcamentos_decididos: number;
}

const PERIODOS: { id: PeriodoAdmin; label: string }[] = [{ id: "hoje", label: "Hoje" }, { id: "7d", label: "7 dias" }, { id: "30d", label: "30 dias" }, { id: "mes", label: "Este mês" }];

/** Admin-only business view. The database refuses non-admins (kpis_admin checks is_admin()). */
export function VisaoAdmin() {
  const [periodo, setPeriodo] = useState<PeriodoAdmin>("mes");
  const { data: k, isLoading, isError } = useQuery({
    queryKey: ["kpis-admin", periodo],
    queryFn: async (): Promise<KpisAdmin> => {
      const { data, error } = await supabase.rpc("kpis_admin", { p_periodo: periodo });
      if (error) throw error;
      return data as unknown as KpisAdmin;
    },
    staleTime: 30_000,
  });
  const n = (v: number) => formatInt(Number(v) || 0);
  const ticket = k && k.pedidos_aprovados ? k.receita_bruta / k.pedidos_aprovados : 0;
  const atencao = k ? [k.fila_parada, k.mp_problemas, k.pedidos_pendentes_1h, k.ponte_desatualizada].some((x) => x > 0) : false;

  return (
    <div className="space-y-7">
      <Segmented label="Período" options={PERIODOS} value={periodo} onChange={setPeriodo} />
      {isError ? <p className="text-sm text-destructive-ink">Não foi possível carregar os números.</p> : isLoading || !k ? <KpiSkeleton secoes={4} /> : (
        <>
          {atencao && (
            <Secao titulo="Atenção">
              {k.fila_parada > 0 && <Kpi tom="alerta" rotulo="Paradas na fila +10 min" link={linkAdmin("usuarios")} valor={n(k.fila_parada)} />}
              {k.mp_problemas > 0 && <Kpi tom="alerta" rotulo="Avisos do Mercado Pago com problema" link={linkAdmin("financeiro")} valor={n(k.mp_problemas)} />}
              {k.pedidos_pendentes_1h > 0 && <Kpi tom="atencao" rotulo="Pedidos pendentes +1 h" link={linkAdmin("financeiro")} valor={n(k.pedidos_pendentes_1h)} />}
              {k.ponte_desatualizada > 0 && <Kpi tom="atencao" rotulo="Ponte desatualizada" link={linkAdmin("ponte")} valor={n(k.ponte_desatualizada)} contexto="computadores" />}
            </Secao>
          )}
          <Secao titulo="Usuários">
            <Kpi rotulo="Total" link={linkAdmin("usuarios", "todos")} valor={n(k.usuarios_total)} />
            <Kpi rotulo="Novos no período" link={linkAdmin("usuarios")} valor={n(k.usuarios_novos)} />
            <Kpi rotulo="Ativos no período" link={linkAdmin("usuarios", "ativos")} valor={n(k.usuarios_ativos)} contexto="fizeram 1+ análise" />
            <Kpi rotulo="Em teste grátis" link={linkAdmin("usuarios")} valor={n(k.em_teste)} contexto="agora" />
            <Kpi rotulo="Pagantes" tom="sucesso" link={linkAdmin("usuarios")} valor={n(k.pagantes)} contexto="1+ compra aprovada" />
            <Kpi rotulo="Bloqueados" link={linkAdmin("usuarios", "bloqueados")} valor={n(k.bloqueados)} />
          </Secao>
          <Secao titulo="Computadores">
            <Kpi rotulo="Conectados agora" link={linkAdmin("usuarios")} valor={`${n(k.computadores_conectados)} / ${n(k.computadores_total)}`} />
            <Kpi rotulo="Sem computador" link={linkAdmin("usuarios", "sem_computador")} valor={n(k.sem_computador)} contexto="usuários" />
          </Secao>
          <Secao titulo="Análises">
            <Kpi rotulo="No período" link={linkAdmin("usuarios")} valor={n(k.analises)} />
            <Kpi rotulo="Concluídas" link={linkAdmin("usuarios")} valor={n(k.concluidas)} />
            <Kpi rotulo="Taxa de sucesso" link={linkAdmin("usuarios")} valor={formatPct(k.concluidas, k.analises)} />
            <Kpi rotulo="Erros" tom={k.erros > 0 ? "atencao" : "normal"} link={linkAdmin("usuarios")} valor={n(k.erros)} />
            <Kpi pequeno rotulo="Configurar" link={linkAdmin("usuarios")} valor={n(k.por_roteiro.config_geral)} />
            <Kpi pequeno rotulo="Reduzir tempo" link={linkAdmin("usuarios")} valor={n(k.por_roteiro.reduzir_tempo)} />
            <Kpi pequeno rotulo="Checklist" link={linkAdmin("usuarios")} valor={n(k.por_roteiro.checklist)} />
            <Kpi pequeno rotulo="Preço" link={linkAdmin("usuarios")} valor={n(k.por_roteiro.preco)} />
          </Secao>
          <Secao titulo="Dinheiro">
            <Kpi rotulo="Receita bruta" link={linkAdmin("financeiro")} valor={formatReais(Number(k.receita_bruta))} />
            <Kpi rotulo="Receita líquida" link={linkAdmin("financeiro")} valor={formatReais(Number(k.receita_liquida))} contexto="após taxas do Mercado Pago" />
            <Kpi rotulo="Pedidos aprovados" link={linkAdmin("financeiro")} valor={n(k.pedidos_aprovados)} contexto={`ticket médio ${formatReais(ticket)}`} />
            <Kpi rotulo="Custo de IA" link={linkAdmin("financeiro")} valor={formatUSD(Number(k.custo_ia_usd))} contexto={`margem ${formatReais(Number(k.margem_brl))}`} tom={k.margem_brl < 0 ? "alerta" : "normal"} />
          </Secao>
          <Secao titulo="Créditos">
            <Kpi rotulo="Vendidos" link={linkAdmin("financeiro")} valor={n(k.creditos_vendidos)} />
            <Kpi rotulo="Consumidos" link={linkAdmin("financeiro")} valor={n(k.creditos_consumidos)} />
            <Kpi rotulo="Em circulação" link={linkAdmin("financeiro")} valor={n(k.creditos_circulacao)} contexto="saldo de todos" />
            <Kpi rotulo="Vencendo em 30 dias" link={linkAdmin("financeiro")} valor={n(k.creditos_vencendo_30d)} />
          </Secao>
          <Secao titulo="Engajamento">
            <Kpi rotulo="Cupons resgatados" link={linkAdmin("cupons")} valor={n(k.cupons_resgatados)} />
            <Kpi rotulo="Fez sentido" link={linkAdmin("feedback")} valor={formatPct(k.feedback_sentido, k.feedback_total)} contexto={`${n(k.feedback_total)} respostas`} />
            <Kpi rotulo="Imprimiu e ficou boa" link={linkAdmin("feedback")} valor={formatPct(k.feedback_boa, k.feedback_imprimiu)} contexto="de quem imprimiu" />
            <Kpi rotulo="Orçamentos gerados" valor={n(k.orcamentos)} contexto={`${formatPct(k.orcamentos_aprovados, k.orcamentos_decididos)} aprovados`} />
          </Secao>
        </>
      )}
    </div>
  );
}
