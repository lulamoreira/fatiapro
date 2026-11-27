import type { Malha } from "./malha";
import type { Pintura, Alteracao } from "./pintura";
import { folha, lerFace, escreverFace } from "./pintura";
import { watershed } from "./watershed";
import type { Semente } from "./watershed";
import { pintarFormas } from "./operacoes";
import { planoDaSuperficie } from "./formas";
import type { Forma } from "./formas";
import { herdarCores } from "./ia-regioes";
export interface PlanoPinturaIA { regioes:{id:number;slot:number}[]; sementes:Semente[]; formas:{forma:Forma;slot:number}[] }
export function copiarPintura(p:Pintura):Pintura {return {slots:p.slots.slice(),detalhes:new Map(p.detalhes)};}
export function montarPrevia(m:Malha,regioes:Uint32Array,original:Pintura,plano:PlanoPinturaIA,semRosto=false,linhas:ReadonlySet<number>=new Set()):Pintura {
  const p=copiarPintura(original),cores=herdarCores(m,regioes,new Map(plano.regioes.map(r=>[r.id,r.slot])),linhas),divididas=watershed(m,regioes,plano.sementes);
  for(let f=0;f<p.slots.length;f++)escreverFace(p,f,folha(divididas[f]||cores.get(regioes[f]??0)||1));
  if(!semRosto)for(const {forma,slot} of plano.formas){const orientada=planoDaSuperficie(m.posicoes,forma,forma);for(let f=0;f<p.slots.length;f++)escreverFace(p,f,pintarFormas(m,f,lerFace(p,f),[orientada],slot));}
  return p;
}
export function diferencaPintura(original:Pintura,proposta:Pintura):Alteracao[]{
  const diff:Alteracao[]=[];for(let f=0;f<original.slots.length;f++){const antes=lerFace(original,f),depois=lerFace(proposta,f);if(antes===depois||("slot"in antes&&"slot"in depois&&antes.slot===depois.slot))continue;diff.push({face:f,antes,depois});}return diff;
}
