import type { PropostaGeral, PropostaRosto } from "./ia-schema";
import { reduzirPaleta } from "./ia-cores";
import type { FusaoCor } from "./ia-cores";
import { atingir, criarAlvo, conferirOlhos, formaDePixels } from "./ia-geometria";
import type { CameraIA } from "./ia-geometria";
import type { PlanoPinturaIA } from "./ia-previa";
import type { CorSlot } from "./paleta";
import type { Forma } from "./formas";
import type { SerializedBVH } from "three-mesh-bvh";
export function planoProposta(p:PropostaGeral,rosto:PropostaRosto|null,posicoes:Float32Array,regioes:Uint32Array,bvh:SerializedBVH|null,cameras:Record<string,CameraIA>,close:CameraIA|null,areas:readonly {id:number;area:number}[],n:number,escolhas:readonly FusaoCor[]=[]){
  const reducao=reduzirPaleta(p,areas,n,escolhas),alvo=criarAlvo(posicoes,bvh),plano:PlanoPinturaIA={regioes:p.regioes.map(r=>({id:r.id,slot:reducao.mapa[r.cor]??1})),sementes:[],formas:[]},avisos=[...p.avisos],manuais:{forma:Forma;slot:number}[]=[];
  try{
    for(const d of p.dividir){let validas=0;for(const s of d.sementes){const cam=cameras[s.vista];if(!cam)continue;const hit=atingir(cam,s.x,s.y,alvo.mesh);if(!hit||regioes[hit.face]!==d.id)continue;validas++;plano.sementes.push({id:plano.sementes.length+1,face:hit.face,ponto:hit.ponto,slot:reducao.mapa[s.cor]??1});}
      if(validas<2){plano.sementes=plano.sementes.filter(s=>regioes[s.face]!==d.id);avisos.push(`Confira a região ${d.id}: não foi possível posicionar as sementes da divisão.`);}
    }
    if(rosto&&close){avisos.push(...rosto.avisos);const olhosValidos=conferirOlhos(rosto);if(!olhosValidos&&rosto.olhos.length)avisos.push("Confira os olhos: a IA sugeriu um tamanho fora do esperado");
      for(const o of rosto.olhos){const forma=formaDePixels(close,alvo.mesh,posicoes,o,"oval");if(!forma){avisos.push("Confira os olhos: o centro sugerido não encontrou a superfície.");continue;}const sugestao={forma,slot:reducao.mapa[o.cor]??1};manuais.push(sugestao);if(olhosValidos)plano.formas.push(sugestao);}
      if(rosto.boca){const forma=formaDePixels(close,alvo.mesh,posicoes,rosto.boca,"sorriso");if(forma)plano.formas.push({forma,slot:reducao.mapa[rosto.boca.cor]??1});else avisos.push("Confira a boca: o centro sugerido não encontrou a superfície.");}
    }
  }finally{alvo.dispose();}
  const paleta:CorSlot[]=reducao.ativas.map(i=>({nome:p.paleta[i]?.nome??"Cor",cor:p.paleta[i]?.hex??"#FFFFFF"}));
  return {plano,paleta,avisos,manuais,reducao};
}
