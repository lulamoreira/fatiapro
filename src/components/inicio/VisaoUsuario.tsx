import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AlertCircle, FilePlus2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { devicesQuery } from "@/lib/queries";
import { ESTADOS, formatUSD, isConectado, roteiroLabel, type Estado } from "@/lib/fatia";
import { DIAS_TESTE } from "@/lib/plano";
import { usePlano } from "@/hooks/use-plano";
import { useNow } from "@/hooks/use-now";
import { formatHorasMin, formatInt, formatPct, formatPeso, formatReais, linkHistorico, linkOrc } from "@/lib/inicio";
import { Dot, EmptyState, Tag } from "@/components/fatia/Chip";
import { Button } from "@/components/ui/button";
import { Kpi, KpiSkeleton, Secao } from "./Kpi";

export interface KpisUsuario {
  em_andamento: number; aguardando_aprovacao: number; analises_total: number; analises_mes: number; otimizados: number;
  segundos_economizados: number; gramas_economizadas: number; checklists: number; precos: number; erros_30d: number;
  orc_enviados: number; orc_aprovados: number; orc_recusados: number; orc_aprovado_mes_centavos: number;
  pecas: number; modelos: number; api_usd_mes: number; assinatura_mes: number; usou_motor_proprio: boolean;
  ultima: { id: string; nome_peca: string | null; roteiro: string; estado: string; criado_em: string } | null;
}

export const kpisUsuarioQuery = {
  queryKey: ["kpis-usuario"],
  queryFn: async (): Promise<KpisUsuario> => {
    const { data, error } = await supabase.rpc("kpis_usuario");
    if (error) throw error;
    return data as unknown as KpisUsuario;
  },
  staleTime: 30_000,
};

const dataCurta = (iso: string) => new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });

export function VisaoUsuario() {
  const { data: k, isLoading } = useQuery(kpisUsuarioQuery);
  const { data: p } = usePlano();
  const { data: devices = [] } = useQuery(devicesQuery);
  const now = useNow(10_000);

  if (isLoading || !k) return <KpiSkeleton />;
  if (k.analises_total === 0 && devices.length === 0)
    return <EmptyState icon={<FilePlus2 />} titulo="Faça sua primeira análise" texto="Conecte seu computador e peça a primeira otimização. Os números aparecem aqui." acao={<Button asChild><Link to="/app/nova-analise">Nova análise</Link></Button>} />;

  const on = devices.find((d) => isConectado(d.ultimo_contato, now));
  const dev = on ?? devices[0];
  const teste = p?.teste?.ativo ? p.teste : null;
  const cortesia = p?.cortesia;
  const decididos = k.orc_aprovados + k.orc_recusados;

  return (
    <div className="space-y-7">
      {k.aguardando_aprovacao > 0 && (
        <Link {...linkHistorico({ estado: "aguardando_aprovacao" })} className="flex items-center gap-3 rounded-2xl border border-warning/50 bg-warning/15 p-4 text-sm font-semibold transition-colors hover:bg-warning/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <AlertCircle className="size-5 shrink-0" aria-hidden />
          Você tem {k.aguardando_aprovacao} {k.aguardando_aprovacao === 1 ? "análise esperando" : "análises esperando"} sua aprovação
        </Link>
      )}

      <Secao titulo="Agora">
        <Kpi rotulo="Computador" link={{ to: "/app/configuracoes" }} pequeno
          valor={<span className="flex items-center gap-2 truncate"><Dot on={!!on} />{dev?.nome ?? "Nenhum"}</span>}
          contexto={dev ? `${on ? "Conectado" : "Desconectado"}${dev.versao_ponte ? ` · ponte ${dev.versao_ponte}` : ""}` : "Conecte seu computador"} />
        <Kpi rotulo="Saldo" link={{ to: "/app/plano" }} valor={p ? `${formatInt(p.saldo)} ${p.saldo === 1 ? "crédito" : "créditos"}` : "…"}
          contexto={p?.proximo_vencimento ? `${p.proximo_vencimento.quantidade} ${p.proximo_vencimento.quantidade === 1 ? "vence" : "vencem"} em ${dataCurta(p.proximo_vencimento.expira_em)}` : undefined} />
        {teste ? (
          <Kpi rotulo="Teste grátis" link={{ to: "/app/plano" }} tom="sucesso" valor={`Dia ${teste.dia_atual} de ${DIAS_TESTE}`} contexto={`termina ${new Date(teste.fim).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}`} />
        ) : cortesia ? (
          <Kpi rotulo="Cortesia" link={{ to: "/app/plano" }} tom="sucesso" valor="Ativa" contexto={cortesia.tipo === "uso_diario" ? `${cortesia.usadas_hoje} de ${cortesia.por_dia ?? 0} hoje` : "Créditos de cortesia"} />
        ) : null}
        <Kpi rotulo="Em andamento" link={linkHistorico({ estado: "em_andamento" })} valor={formatInt(k.em_andamento)} />
      </Secao>

      <Secao titulo="Suas análises">
        <Kpi rotulo="Análises feitas" link={linkHistorico()} valor={formatInt(k.analises_total)} contexto={`${formatInt(k.analises_mes)} este mês`} />
        <Kpi rotulo="Arquivos otimizados" link={linkHistorico({ estado: "concluido", roteiro: "otimizacao" })} valor={formatInt(k.otimizados)} contexto="Configuração geral e Reduzir tempo" />
        <Kpi rotulo="Tempo economizado" tom={k.segundos_economizados > 0 ? "sucesso" : "normal"} link={linkHistorico({ estado: "concluido", roteiro: "reduzir_tempo" })} valor={formatHorasMin(k.segundos_economizados)} contexto="de impressão, em Reduzir tempo" />
        <Kpi rotulo="Filamento economizado" link={linkHistorico({ estado: "concluido", roteiro: "reduzir_tempo" })} valor={formatPeso(k.gramas_economizadas)} contexto="em Reduzir tempo" />
        <Kpi rotulo="Checklists feitos" link={linkHistorico({ roteiro: "checklist" })} valor={formatInt(k.checklists)} />
        <Kpi rotulo="Preços calculados" link={linkHistorico({ roteiro: "preco" })} valor={formatInt(k.precos)} />
        {k.erros_30d > 0 && <Kpi rotulo="Com erro (30 dias)" tom="atencao" link={linkHistorico({ estado: "erro", periodo: "30d" })} valor={formatInt(k.erros_30d)} contexto="Veja o que aconteceu" />}
      </Secao>

      <Secao titulo="Seu negócio">
        <Kpi rotulo="Orçamentos enviados" link={linkOrc("enviado")} valor={formatInt(k.orc_enviados)} />
        <Kpi rotulo="Aprovados" tom={k.orc_aprovados ? "sucesso" : "normal"} link={linkOrc("aprovado")} valor={formatInt(k.orc_aprovados)} />
        <Kpi rotulo="Recusados" link={linkOrc("recusado")} valor={formatInt(k.orc_recusados)} />
        <Kpi rotulo="Taxa de aprovação" link={linkOrc("aprovado")} valor={formatPct(k.orc_aprovados, decididos)} contexto={`${formatReais(k.orc_aprovado_mes_centavos / 100)} aprovados no mês`} />
        <Kpi rotulo="Peças na biblioteca" link={{ to: "/app/biblioteca" }} valor={formatInt(k.pecas)} />
        <Kpi rotulo="Modelos salvos" link={{ to: "/app/modelos" }} valor={formatInt(k.modelos)} />
      </Secao>

      {k.usou_motor_proprio && (
        <Secao titulo="Uso da IA">
          <Kpi rotulo="Gasto na sua chave de API" link={linkHistorico()} valor={formatUSD(k.api_usd_mes)} contexto="este mês" />
          <Kpi rotulo="Pela assinatura" link={linkHistorico()} valor={formatInt(k.assinatura_mes)} contexto="análises este mês" />
        </Secao>
      )}

      {k.ultima && (
        <Link to="/app/analise/$id" params={{ id: k.ultima.id }} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-card p-4 text-sm shadow-sm transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <span className="min-w-0">
            <span className="block text-xs font-semibold text-muted-foreground">Última análise</span>
            <span className="block truncate font-semibold">{k.ultima.nome_peca ?? "Peça aberta no fatiador"}</span>
            <span className="block text-xs text-muted-foreground">{roteiroLabel(k.ultima.roteiro)} · {dataCurta(k.ultima.criado_em)}</span>
          </span>
          {(() => { const e = ESTADOS[k.ultima.estado as Estado] ?? ESTADOS.na_fila; return <Tag tone={e.tone}>{e.label}</Tag>; })()}
        </Link>
      )}
    </div>
  );
}
