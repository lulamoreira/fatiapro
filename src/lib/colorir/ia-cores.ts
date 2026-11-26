import Color from "colorjs.io";
import type { PropostaGeral } from "./ia-schema";
export interface FusaoCor { origem:number; destino:number }
export function ciede2000(a:string,b:string):number { return new Color(a).deltaE(new Color(b),"2000"); }
export function reduzirPaleta(p:PropostaGeral,areas:readonly {id:number;area:number}[],n:number,escolhas:readonly FusaoCor[]=[]):{mapa:number[];fusoes:FusaoCor[];ativas:number[]} {
  const pesos=p.paleta.map(()=>0), porId=new Map(areas.map(r=>[r.id,r.area]));
  for(const r of p.regioes) pesos[r.cor]=(pesos[r.cor]??0)+(porId.get(r.id)??0);
  const mapa=p.paleta.map((_,i)=>i),ativas=new Set(mapa),fusoes:FusaoCor[]=[];
  while(ativas.size>n){const origem=[...ativas].sort((a,b)=>(pesos[a]??0)-(pesos[b]??0)||a-b)[0];if(origem===undefined)break;
    const override=escolhas.find(f=>f.origem===origem)?.destino;
    const destino=override!==undefined&&override!==origem&&ativas.has(override)?override:[...ativas].filter(i=>i!==origem).sort((a,b)=>ciede2000(p.paleta[origem]?.hex??"#FFFFFF",p.paleta[a]?.hex??"#FFFFFF")-ciede2000(p.paleta[origem]?.hex??"#FFFFFF",p.paleta[b]?.hex??"#FFFFFF")||a-b)[0];
    if(destino===undefined)break;for(let i=0;i<mapa.length;i++)if(mapa[i]===origem)mapa[i]=destino;
    pesos[destino]=(pesos[destino]??0)+(pesos[origem]??0);ativas.delete(origem);fusoes.push({origem,destino});
  }
  const final=[...ativas].sort((a,b)=>a-b);return {mapa:mapa.map(i=>final.indexOf(i)+1),fusoes,ativas:final};
}
