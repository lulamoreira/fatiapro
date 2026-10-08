import { describe, expect, it } from "vitest";
import { erroAnalise, etiquetaFonte, linhaUso, motoresVisiveis, payloadQuestionario, ponteDesatualizada, type PlanoInfo } from "./plano";
import { escolherMotor } from "./motor-choice";

const base: PlanoInfo = {
  saldo: 0, proximo_vencimento: null, teste: null, cortesia: null,
  gratis_hoje: { usadas: 3, limite: 20 }, is_admin: false,
};
const teste = (usado_hoje: boolean): PlanoInfo => ({
  ...base, teste: { ativo: true, dia_atual: 3, dias_restantes: 11, fim: "2026-10-20T00:00:00Z", usado_hoje, questionario_pendente_job: null },
});

describe("linha de uso do Resumo", () => {
  it("créditos", () => {
    expect(linhaUso({ ...base, saldo: 12 }, "reduzir_tempo", false).texto).toBe("Usa 1 crédito (ou 2 no Premium) · você tem 12");
  });
  it("teste disponível", () => {
    expect(linhaUso(teste(false), "config_geral", false).texto).toBe("Teste grátis · dia 3 de 14 · otimização de hoje: disponível");
  });
  it("teste usado", () => {
    const l = linhaUso(teste(true), "config_geral", false);
    expect(l.texto).toBe("Teste grátis · dia 3 de 14 · otimização de hoje: já usada — volta amanhã");
  });
  it("cortesia", () => {
    const p: PlanoInfo = { ...base, saldo: 5, cortesia: { tipo: "uso_diario", por_dia: 3, premium: false, fim: null, usadas_hoje: 1 } };
    expect(linhaUso(p, "reduzir_tempo", false).texto).toBe("Cortesia · 1 de 3 hoje");
  });
  it("checklist", () => {
    expect(linhaUso({ ...base, saldo: 9 }, "checklist", false).texto).toBe("Grátis · 3 de 20 hoje");
  });
  it("sem nada mostra Ver planos", () => {
    expect(linhaUso(base, "reduzir_tempo", false)).toEqual({ texto: "Sem créditos", verPlanos: true });
  });
});

describe("erros do criarAnalise", () => {
  it.each([
    ["sem_creditos", "Seus créditos acabaram.", "planos"],
    ["teste_hoje_usado", "Você já usou a otimização grátis de hoje. Volte amanhã ou veja os planos.", "planos"],
    ["premium_no_teste", "A Análise Premium usa créditos. Desligue o Premium para usar o teste grátis.", null],
    ["teste_ja_usado_nesta_maquina", "O teste grátis já foi usado neste computador por outra conta. Veja os planos para continuar.", "planos"],
    ["maquina_sem_identificacao", "A ponte está se atualizando. Tente de novo em alguns minutos.", null],
    ["limite_diario", "Você chegou ao limite de 20 análises grátis de hoje.", null],
  ])("%s", (codigo, mensagem, acao) => {
    expect(erroAnalise(codigo, "x")).toEqual({ mensagem, acao });
  });
  it("questionário pendente abre o questionário", () => {
    expect(erroAnalise("questionario_pendente", "x").acao).toBe("questionario");
  });
  it("códigos de detalhe usam o texto do servidor", () => {
    expect(erroAnalise("computador_invalido", "Computador não encontrado.").mensagem).toBe("Computador não encontrado.");
  });
});

describe("escolha do motor", () => {
  it("usuário comum só tem FatiaProAI, mesmo com chave e assinatura prontas", () => {
    expect(motoresVisiveis(false, { api: true, assinatura: true })).toEqual(["fatiapro"]);
  });
  it("admin vê as 3 opções", () => {
    expect(motoresVisiveis(true, { api: true, assinatura: true })).toEqual(["fatiapro", "api", "assinatura"]);
  });
  it("padrão é FatiaProAI", () => {
    expect(escolherMotor(null, null, ["fatiapro", "api", "assinatura"])).toBe("fatiapro");
  });
  it("ponte anterior a 0.3.0 bloqueia", () => {
    expect(ponteDesatualizada("0.2.9")).toBe(true);
    expect(ponteDesatualizada("0.3.0")).toBe(false);
  });
});

describe("questionário", () => {
  const ok = { fez_sentido: "sim", imprimiu: "sim_boa", problemas: [], tempo_poupado: "ate_15", comentario: "" } as const;
  it("não deixa enviar sem as 3 obrigatórias", () => {
    expect(payloadQuestionario("j", { ...ok, problemas: [], fez_sentido: null })).toBeNull();
    expect(payloadQuestionario("j", { ...ok, problemas: [], imprimiu: null })).toBeNull();
    expect(payloadQuestionario("j", { ...ok, problemas: [], tempo_poupado: null })).toBeNull();
  });
  it("problemas só quando deu problema", () => {
    expect(payloadQuestionario("j", { ...ok, problemas: ["descolou"] })?.problemas).toEqual([]);
    expect(payloadQuestionario("j", { ...ok, imprimiu: "sim_problema", problemas: ["descolou"] })?.problemas).toEqual(["descolou"]);
  });
});

describe("etiqueta da fonte", () => {
  it("crédito devolvido", () => {
    expect(etiquetaFonte({ fonte: "creditos", creditos_reservados: 0, estado: "erro" })).toBe("Crédito devolvido");
    expect(etiquetaFonte({ fonte: "creditos", premium: true, creditos_reservados: 2, estado: "concluido" })).toBe("2 créditos · Premium");
  });
});
