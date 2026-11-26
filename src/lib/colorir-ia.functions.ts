import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { EntradaColorir, validarGeral, validarRosto, schemaGeralJSON, schemaRostoJSON, SISTEMA_GERAL, SISTEMA_ROSTO } from "./colorir/ia-schema";
import type { PropostaGeral, PropostaRosto } from "./colorir/ia-schema";
import { MODELO_IA, custoChamadaUSD } from "./ia";
import { setResponseStatus } from "@tanstack/react-start/server";
export type ResultadoColorir = { ok: true; etapa: "geral"; dados: PropostaGeral } | { ok: true; etapa: "rosto"; dados: PropostaRosto } | { ok: false; codigo: string; mensagem: string; estornado: boolean };
export function mensagemColorir(codigo: string): string {
  if (codigo === "sem_creditos") return "Você não tem créditos para colorir pela foto.";
  if (codigo === "limite_hora") return "Tente de novo em alguns minutos.";
  if (codigo === "recusa") return "A IA não conseguiu analisar esta foto; tente outra foto.";
  if (codigo === "etapa_ja_usada") return "Esta etapa já foi usada. Inicie uma nova colorização.";
  if (codigo === "maquina_sem_identificacao") return "Conecte seu computador para usar o teste grátis, ou use créditos.";
  if (codigo === "teste_hoje_usado") return "Você já usou o teste grátis de hoje. Use créditos ou volte amanhã.";
  if (codigo === "questionario_pendente") return "Responda o questionário da última análise para continuar no teste grátis.";
  if (codigo === "teste_ja_usado_nesta_maquina") return "O teste grátis já foi usado neste computador por outra conta.";
  if (codigo === "acesso_negado") return "O acesso à IA está indisponível. O responsável precisa restaurar o acesso antes de uma nova colorização.";
  return "Não deu certo desta vez; seu crédito foi devolvido.";
}
export const colorirPelaFoto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(d => EntradaColorir.parse(d))
  .handler(async ({ data, context }): Promise<ResultadoColorir> => {
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    const key = process.env["ANTHROPIC_API_KEY"];
    let iniciada = false;
    const falha = async (codigo: string): Promise<ResultadoColorir> => {
      let estornado = false;
      if (iniciada && data.etapa === "geral") {
        const r = await db.rpc("estornar_colorir", { p_chave: data.chave });
        estornado = !r.error;
      }
      const mensagem = iniciada && data.etapa === "rosto" ? "As cores ficaram prontas, mas não foi possível sugerir olhos e boca. Confira os avisos e aplique só as cores." : mensagemColorir(codigo);
      return { ok: false, codigo, mensagem: iniciada && data.etapa === "geral" && !estornado ? "Não deu certo desta vez. Não foi possível confirmar a devolução do crédito; confira seu extrato." : mensagem, estornado };
    };
    if (!key) return { ok: false, codigo: "ia_indisponivel", mensagem: "A IA não está configurada. Nenhum crédito foi cobrado.", estornado: false };
    const blocked = await db.from("colorir_ia_bloqueios").select("motivo").eq("user_id", context.userId).maybeSingle();
    if (blocked.error) return falha("ia_indisponivel");
    if (blocked.data) return falha("acesso_negado");
    const inicio = await db.rpc("iniciar_colorir_etapa", { p_user: context.userId, p_chave: data.chave, p_etapa: data.etapa, p_nome: data.nome, p_ids: data.ids, p_slots: data.slots });
    if (inicio.error) {
      const codigo = ["sem_creditos","limite_hora","etapa_ja_usada","maquina_sem_identificacao","teste_hoje_usado","teste_ja_usado_nesta_maquina","questionario_pendente"].find(c => inicio.error?.message.includes(c)) ?? "dados_invalidos";
      return { ok: false, codigo, mensagem: mensagemColorir(codigo), estornado: false };
    }
    iniciada = true;
    try {
      const meta = z.object({ paleta: z.array(z.object({ nome:z.string(),hex:z.string() })).nullable(), gasto_usd: z.number().or(z.string()).transform(Number) }).parse(inicio.data);
      const [cfg, preco] = await Promise.all([
        db.from("config_app").select("valor").eq("chave","custo_teto_colorir_usd").maybeSingle(),
        db.from("price_table").select("preco_entrada_usd_por_milhao,preco_saida_usd_por_milhao").eq("modelo",MODELO_IA.padrao).maybeSingle(),
      ]);
      if (cfg.error || preco.error || !preco.data) return falha("ia_indisponivel");
      const teto = cfg.data ? Number(cfg.data.valor) : .30;
      const pIn = Number(preco.data.preco_entrada_usd_por_milhao), pOut = Number(preco.data.preco_saida_usd_por_milhao);
      // Conservative upper bound for six documented image sizes + instructions/cache writes.
      const inputBudget = (data.etapa === "geral" ? 30000 : 12000) * pIn * 1.25 / 1e6;
      const disponivel = teto - meta.gasto_usd - inputBudget;
      const maxTokens = Math.min(16000, Math.floor(disponivel * (data.etapa === "geral" ? .7 : 1) * 1e6 / pOut));
      if (!Number.isFinite(teto) || teto <= 0 || pIn <= 0 || pOut <= 0 || maxTokens < 1024) return falha("limite_de_gasto");
      if (data.etapa === "rosto" && !meta.paleta) return falha("incompleta");
      const t0 = Date.now();
      const resp = await fetch("https://api.anthropic.com/v1/messages", {
        method:"POST", headers:{ "x-api-key":key,"anthropic-version":"2023-06-01","content-type":"application/json" },
        body: JSON.stringify({ model:MODELO_IA.padrao, max_tokens:maxTokens,
          system:[{ type:"text", text:data.etapa === "geral" ? SISTEMA_GERAL.replace("N cores",`${data.slots} cores`) : SISTEMA_ROSTO, cache_control:{type:"ephemeral"} }],
          messages:[{role:"user",content:[...data.imagens.map(im=>({type:"image",source:{type:"base64",media_type:im.tipo,data:im.base64}})),{type:"text",text:data.etapa === "geral" ? JSON.stringify({ N:data.slots,regioes:data.ids }) : JSON.stringify({paleta:meta.paleta})}]}],
          output_config:{effort:"medium",format:{type:"json_schema",schema:data.etapa === "geral" ? schemaGeralJSON(data.slots) : schemaRostoJSON}},
        }),
      });
      if (!resp.ok) {
        const errorBody: unknown = await resp.json().catch(() => null);
        const providerError = z.object({ error: z.object({ type: z.string(), message: z.string() }) }).safeParse(errorBody);
        // Only provider status/type are recorded, never request content or images.
        console.error("[colorir/ia]", resp.status, providerError.success ? providerError.data.error.type : "resposta_invalida");
        if (resp.status === 403 || resp.status === 401) {
          setResponseStatus(resp.status);
          await db.from("colorir_ia_bloqueios").upsert({user_id:context.userId,motivo:"acesso_negado"});
          return falha("acesso_negado");
        }
        return falha("ia_indisponivel");
      }
      const r = z.object({stop_reason:z.string().nullable(),content:z.array(z.object({type:z.string(),text:z.string().optional()})),usage:z.object({input_tokens:z.number().nonnegative().default(0),output_tokens:z.number().nonnegative().default(0),cache_read_input_tokens:z.number().nonnegative().default(0),cache_creation_input_tokens:z.number().nonnegative().default(0)})}).parse(await resp.json());
      const u = r.usage, custo = custoChamadaUSD(u,pIn,pOut);
      const registro = await db.from("ia_chamadas").insert({job_id:null,user_id:context.userId,modelo:MODELO_IA.padrao,origem:"colorir",chave_colorir:data.chave,entrada:u["input_tokens"]??0,saida:u["output_tokens"]??0,cache_leitura:u["cache_read_input_tokens"]??0,cache_escrita:u["cache_creation_input_tokens"]??0,custo_usd:custo,duracao_ms:Date.now()-t0});
      if (registro.error) return falha("ia_indisponivel");
      const custoR = await db.from("colorir_pedidos").update({gasto_usd:meta.gasto_usd+custo}).eq("chave",data.chave).eq("user_id",context.userId);
      if(custoR.error || meta.gasto_usd+custo>teto) return falha("limite_de_gasto");
      if(r.stop_reason === "refusal") return falha("recusa");
      if(r.stop_reason !== "end_turn") return falha("incompleta");
      const raw: unknown = JSON.parse(r.content.filter(c=>c.type === "text").map(c=>c.text??"").join(""));
      const dados = data.etapa === "geral" ? validarGeral(raw,data.ids) : validarRosto(raw,meta.paleta?.length??0);
      const update = data.etapa === "geral" ? {estado:"pronto",paleta:(dados as PropostaGeral).paleta} : {estado:"concluido"};
      const gravado = await db.from("colorir_pedidos").update({...update,atualizado_em:new Date().toISOString()}).eq("chave",data.chave).eq("user_id",context.userId).eq("estado",data.etapa).select("chave").maybeSingle();
      if(gravado.error || !gravado.data) return falha("cancelado");
      return data.etapa === "geral" ? {ok:true,etapa:"geral",dados:dados as PropostaGeral} : {ok:true,etapa:"rosto",dados:dados as PropostaRosto};
    } catch { return falha("incompleta"); }
  });
export const cancelarColorir = createServerFn({method:"POST"}).middleware([requireSupabaseAuth]).inputValidator(d=>z.object({chave:z.string().uuid()}).parse(d)).handler(async({data,context})=>{
  const {supabaseAdmin:db}=await import("@/integrations/supabase/client.server");
  const r=await db.rpc("cancelar_colorir",{p_user:context.userId,p_chave:data.chave});
  return {ok:!r.error,estornado:r.data===true};
});
