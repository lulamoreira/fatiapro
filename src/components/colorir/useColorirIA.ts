import { useRef, useState, useEffect, useMemo, useCallback } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { colorirPelaFoto, cancelarColorir } from "@/lib/colorir-ia.functions";
import { meuPlano } from "@/lib/plano.functions";
import { prepararImagens, prepararClose } from "@/lib/colorir/ia-imagens";
import type { ImagensGerais } from "@/lib/colorir/ia-imagens";
import type { PropostaGeral, PropostaRosto } from "@/lib/colorir/ia-schema";
import type { CameraIA } from "@/lib/colorir/ia-geometria";
import { planoProposta } from "@/lib/colorir/ia-plano";
import type { FusaoCor } from "@/lib/colorir/ia-cores";
import type { CorSlot } from "@/lib/colorir/paleta";
import type { useColorir } from "./useColorir";
export interface PropostaLocal { geral:PropostaGeral; rosto:PropostaRosto|null; imagens:ImagensGerais; close:CameraIA|null }
export function useColorirIA(api:ReturnType<typeof useColorir>,nome:string,foto:string|null,n:number,onPaleta:(p:CorSlot[])=>void){
  const chamar=useServerFn(colorirPelaFoto),cancelarFn=useServerFn(cancelarColorir),saldoFn=useServerFn(meuPlano),queryClient=useQueryClient();
  const saldo=useQuery({queryKey:["plano"],queryFn:()=>saldoFn(),staleTime:30000});
  const [etapa,setEtapa]=useState<string|null>(null),[consentimento,setConsentimento]=useState(false),[proposta,setProposta]=useState<PropostaLocal|null>(null),[fusoes,setFusoes]=useState<FusaoCor[]>([]),[semRosto,setSemRosto]=useState(false),[selecionada,setSelecionada]=useState<number|null>(null),[erro,setErro]=useState<{codigo:string;mensagem:string}|null>(null);
  const [inicio,setInicio]=useState<number|null>(null),avisado=useRef(false);
  const run=useRef<{chave:string;controller:AbortController;geralRecebida:boolean}|null>(null),montada=useRef(true),previewReady=useRef(false);
  const montagem=useMemo(()=>proposta&&api.dados?planoProposta(proposta.geral,proposta.rosto,api.dados.posicoes,api.dados.regioes,api.dados.bvh,proposta.imagens.cameras,proposta.close,proposta.imagens.areas,n,fusoes):null,[proposta,api.dados?.posicoes,api.dados?.regioes,n,fusoes]);
  useEffect(()=>{if(!montagem)return;previewReady.current=false;setEtapa("Montando a prévia");api.enviar({tipo:"previaIA",plano:montagem.plano,semRosto},true);},[montagem,semRosto,api.enviar]);
  useEffect(()=>{if(api.previa){previewReady.current=true;setEtapa(null);}},[api.previa]);
  const pronta=!!proposta&&!!api.previa&&!etapa;
  useEffect(()=>{if(pronta&&!avisado.current){avisado.current=true;toast.success("Prévia pronta! Confira as cores e clique em Aplicar.");}},[pronta]);
  useEffect(()=>{if(etapa==="Montando a prévia"&&!api.ocupado&&!api.previa){setEtapa(null);}},[api.ocupado,api.previa,etapa]);
  const cancelar=useCallback(async()=>{
    const r=run.current;run.current=null;r?.controller.abort();setEtapa(null);
    if(r&&!r.geralRecebida){try{const result=await cancelarFn({data:{chave:r.chave}});if(result.ok&&result.estornado)toast.info("Colorização cancelada; seu crédito foi devolvido.");else if(!result.ok)toast.error("Não foi possível confirmar a devolução. Confira seu extrato.");}catch{toast.error("Não foi possível confirmar a devolução. Confira seu extrato.");}}
    void queryClient.invalidateQueries({queryKey:["plano"]});
  },[cancelarFn,queryClient]);
  useEffect(()=>{montada.current=true;return()=>{montada.current=false;const r=run.current;r?.controller.abort();if(r&&!r.geralRecebida)void cancelarFn({data:{chave:r.chave}}).catch(()=>{});};},[cancelarFn]);
  async function iniciar(){
    if(!api.dados||!foto||run.current||proposta)return;
    const atual={chave:crypto.randomUUID(),controller:new AbortController(),geralRecebida:false};run.current=atual;avisado.current=false;setInicio(Date.now());setErro(null);setConsentimento(false);setEtapa("Preparando imagens");
    try{
      const imagens=await prepararImagens(api.dados.posicoes,api.dados.regioes,foto,atual.controller.signal);atual.controller.signal.throwIfAborted();setEtapa("IA analisando as cores");
      const geral=await chamar({data:{chave:atual.chave,etapa:"geral",nome:nome.slice(0,200)||"peça",slots:n,ids:imagens.ids,imagens:[imagens.foto,...imagens.vistas]}});
      atual.controller.signal.throwIfAborted();atual.geralRecebida=true;
      if(!geral.ok){setErro({codigo:geral.codigo,mensagem:geral.mensagem});return;}if(geral.etapa!=="geral")throw new Error("Resposta incompleta.");
      let rosto:PropostaRosto|null=null,close:CameraIA|null=null;const avisos:string[]=[];
      if(geral.dados.rosto){
        setEtapa("IA analisando o rosto");try{const recorte=prepararClose(api.dados.posicoes,api.dados.regioes,geral.dados.rosto.regiao_id);close=recorte.camera;
          const r=await chamar({data:{chave:atual.chave,etapa:"rosto",nome:nome.slice(0,200)||"peça",slots:n,ids:imagens.ids,imagens:[imagens.foto,recorte.imagem]}});
          atual.controller.signal.throwIfAborted();if(r.ok&&r.etapa==="rosto")rosto=r.dados;else if(!r.ok)avisos.push(r.mensagem);
        }catch{if(atual.controller.signal.aborted)throw new Error("Cancelado");avisos.push("Não foi possível analisar o rosto. Confira e aplique só as cores.");}
      }
      atual.controller.signal.throwIfAborted();setFusoes([]);setSemRosto(false);setProposta({geral:{...geral.dados,avisos:[...geral.dados.avisos,...avisos]},rosto,close,imagens});
    }catch{
      if(!atual.controller.signal.aborted&&montada.current){
        const r=await cancelarFn({data:{chave:atual.chave}}).catch(()=>null);
        setErro({codigo:"ia_indisponivel",mensagem:r?.estornado?"Não deu certo desta vez; seu crédito foi devolvido.":"Não foi possível concluir. Confira seu extrato antes de tentar novamente."});
      }
    }finally{if(run.current===atual){run.current=null;if(montada.current)setEtapa(null);}void queryClient.invalidateQueries({queryKey:["plano"]});}
  }
  function pedir(){let aceito=false;try{aceito=localStorage.getItem("fatiapro.colorir.ia.consentimento")==="1";}catch{}if(aceito)void iniciar();else setConsentimento(true);}
  function aceitar(){try{localStorage.setItem("fatiapro.colorir.ia.consentimento","1");}catch{}void iniciar();}
  function descartar(){setProposta(null);setSelecionada(null);setEtapa(null);api.enviar({tipo:"descartarIA"});toast.info("Prévia descartada; sua pintura não mudou.");}
  function aplicar(antes:CorSlot[]){if(!montagem||!previewReady.current||api.ocupado)return;onPaleta(montagem.paleta);api.enviar({tipo:"aplicarIA",paletaAntes:antes,paletaDepois:antes.map((c,i)=>montagem.paleta[i]??c)},true);setProposta(null);setSelecionada(null);toast.success("Cores aplicadas. Use ↶ Desfazer se quiser voltar.");}
  function editarCor(index:number,c:CorSlot){setProposta(p=>p?{...p,geral:{...p.geral,paleta:p.geral.paleta.map((old,i)=>i===index?{nome:c.nome,hex:c.cor}:old)}}:p);}
  const temRosto=proposta?!!proposta.geral.rosto:true;
  return {inicio,pronta,temRosto,limparErro:()=>setErro(null),saldo:saldo.data?.saldo,etapa,consentimento,setConsentimento,proposta,montagem,semRosto,setSemRosto,selecionada,setSelecionada,erro,pedir,aceitar,cancelar,descartar,aplicar,editarCor,setFusoes,fusoes};
}
