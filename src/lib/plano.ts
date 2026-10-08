/**
 * Plano e créditos — pure helpers shared by the Resumo, the error messages,
 * the questionnaire and the analysis header. No I/O; unit-tested in plano.test.ts.
 * The database (criar_analise) is the source of truth; these only describe it.
 */
import type { Motor, Roteiro } from "./fatia";
import { compararVersao } from "./ponte";

export interface PlanoInfo {
  saldo: number;
  proximo_vencimento: { quantidade: number; expira_em: string } | null;
  teste: {
    ativo: boolean;
    dia_atual: number;
    dias_restantes: number;
    fim: string;
    usado_hoje: boolean;
    questionario_pendente_job: string | null;
  } | null;
  cortesia: { tipo: "creditos" | "uso_diario"; por_dia: number | null; premium: boolean; fim: string | null; usadas_hoje: number } | null;
  gratis_hoje: { usadas: number; limite: number };
  is_admin: boolean;
}

export const DIAS_TESTE = 14;
export const PONTE_MINIMA = "0.3.0";

export const roteiroComCredito = (r: Roteiro | null | undefined) => r === "reduzir_tempo" || r === "config_geral";
export const custoCreditos = (premium: boolean) => (premium ? 2 : 1);

/** Same order as criar_analise: cortesia de uso diário → créditos → teste grátis. */
export function cortesiaCobre(p: PlanoInfo, premium: boolean): boolean {
  const c = p.cortesia;
  return !!c && c.tipo === "uso_diario" && c.usadas_hoje < (c.por_dia ?? 0) && (!premium || c.premium);
}

/** True when the next optimization would come from the free trial (Premium locked). */
export function usaTeste(p: PlanoInfo): boolean {
  return !cortesiaCobre(p, false) && p.saldo < 1 && !!p.teste?.ativo;
}

export interface LinhaUso { texto: string; verPlanos: boolean }

export function linhaUso(p: PlanoInfo, roteiro: Roteiro | null, premium: boolean): LinhaUso {
  if (roteiro === "checklist" || roteiro === "preco") {
    return { texto: `Grátis · ${p.gratis_hoje.usadas} de ${p.gratis_hoje.limite} hoje`, verPlanos: false };
  }
  if (cortesiaCobre(p, premium)) {
    return { texto: `Cortesia · ${p.cortesia!.usadas_hoje} de ${p.cortesia!.por_dia} hoje`, verPlanos: false };
  }
  if (p.saldo >= custoCreditos(premium)) {
    return { texto: `Usa 1 crédito (ou 2 no Premium) · você tem ${p.saldo}`, verPlanos: false };
  }
  if (p.teste?.ativo && !premium) {
    return {
      texto: `Teste grátis · dia ${p.teste.dia_atual} de ${DIAS_TESTE} · otimização de hoje: ${p.teste.usado_hoje ? "já usada — volta amanhã" : "disponível"}`,
      verPlanos: p.teste.usado_hoje,
    };
  }
  return { texto: "Sem créditos", verPlanos: true };
}

export type AcaoErro = "planos" | "questionario" | null;
export interface ErroAnalise { mensagem: string; acao: AcaoErro }

const ERROS: Record<string, ErroAnalise> = {
  sem_creditos: { mensagem: "Seus créditos acabaram.", acao: "planos" },
  teste_hoje_usado: { mensagem: "Você já usou a otimização grátis de hoje. Volte amanhã ou veja os planos.", acao: "planos" },
  premium_no_teste: { mensagem: "A Análise Premium usa créditos. Desligue o Premium para usar o teste grátis.", acao: null },
  teste_ja_usado_nesta_maquina: { mensagem: "O teste grátis já foi usado neste computador por outra conta. Veja os planos para continuar.", acao: "planos" },
  maquina_sem_identificacao: { mensagem: "A ponte está se atualizando. Tente de novo em alguns minutos.", acao: null },
  limite_diario: { mensagem: "Você chegou ao limite de 20 análises grátis de hoje.", acao: null },
  questionario_pendente: { mensagem: "Conte como foi a sua última otimização para liberar a de hoje.", acao: "questionario" },
};

/** criarAnalise error code → message + action. Unknown codes use the server detail. */
export function erroAnalise(codigo: string, detalhe: string, limiteGratis = 20): ErroAnalise {
  if (codigo === "limite_diario") return { mensagem: `Você chegou ao limite de ${limiteGratis} análises grátis de hoje.`, acao: null };
  return ERROS[codigo] ?? { mensagem: detalhe || "Não foi possível criar a análise.", acao: null };
}

/** Motor cards visible in Nova análise. Common users never get a choice. */
export function motoresVisiveis(isAdmin: boolean, prontos: { api?: boolean; assinatura?: boolean }): Motor[] {
  if (!isAdmin) return ["fatiapro"];
  return ["fatiapro", ...(prontos.api ? (["api"] as const) : []), ...(prontos.assinatura ? (["assinatura"] as const) : [])];
}

/** Bridge too old for FatiaProAI analyses (unknown version is not blocked). */
export const ponteDesatualizada = (versao: string | null | undefined) => !!versao && compararVersao(versao, PONTE_MINIMA) < 0;

export function etiquetaFonte(j: { fonte?: string | null; premium?: boolean | null; creditos_reservados?: number | null; estado: string }): string | null {
  switch (j.fonte) {
    case "creditos":
      if ((j.creditos_reservados ?? 0) === 0 && ["erro", "cancelado", "limite_de_gasto"].includes(j.estado)) return "Crédito devolvido";
      return j.premium ? "2 créditos · Premium" : "1 crédito";
    case "teste": return "Teste grátis";
    case "cortesia": return "Cortesia";
    case "gratis": return "Grátis";
    default: return null;
  }
}

// ===== Questionário =====
export type FezSentido = "sim" | "em_parte" | "nao";
export type Imprimiu = "sim_boa" | "sim_problema" | "ainda_nao" | "nao_vou";
export type Problema = "descolou" | "suporte" | "acabamento" | "fraca" | "outro";
export type TempoPoupado = "nada" | "ate_15" | "15_60" | "mais_60";

export interface RespostasQuestionario {
  fez_sentido: FezSentido | null;
  imprimiu: Imprimiu | null;
  problemas: Problema[];
  tempo_poupado: TempoPoupado | null;
  comentario: string;
}

export const MAX_COMENTARIO = 500;

/** Returns the row to insert, or null while a required answer is missing. */
export function payloadQuestionario(jobId: string, r: RespostasQuestionario) {
  if (!r.fez_sentido || !r.imprimiu || !r.tempo_poupado) return null;
  const comentario = r.comentario.trim().slice(0, MAX_COMENTARIO);
  return {
    job_id: jobId,
    fez_sentido: r.fez_sentido,
    imprimiu: r.imprimiu,
    problemas: r.imprimiu === "sim_problema" ? [...new Set(r.problemas)] : [],
    tempo_poupado: r.tempo_poupado,
    comentario: comentario || null,
  };
}

export const ORIGEM_LOTE: Record<string, string> = {
  teste: "Teste", cortesia: "Cortesia", compra: "Compra", assinatura: "Assinatura", cupom: "Cupom", ajuste: "Ajuste",
};

export function descricaoMovimento(tipo: string, nomePeca: string | null | undefined): string {
  switch (tipo) {
    case "entrada": return "Entrada";
    case "reserva": return `Análise "${nomePeca ?? "Peça aberta no fatiador"}"`;
    case "estorno": return "Devolvido — falha na análise";
    case "vencimento": return "Vencimento";
    default: return "Ajuste";
  }
}
