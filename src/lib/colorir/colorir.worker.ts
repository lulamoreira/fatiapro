import {lerSTL,prepararMalha,segmentar} from './malha';
import type {Malha} from './malha';
import {Historico,folha,lerFace,escreverFace,triangulo,folhas,coresUsadas,trocarSlot} from './pintura';
import type {Pintura,Alteracao,No} from './pintura';
import {aplicarForma} from './formas';
import {watershed} from './watershed';
import {exportar3mf} from './exportar3mf';
import type {Comando,Resposta,DetalhesRender} from './protocolo';
const scope=self as unknown as {postMessage:(r:Resposta,transfer?:Transferable[])=>void;onmessage:((e:MessageEvent<Comando>)=>void)|null};
let malha:Malha|null=null,regioes=new Uint32Array(),pintura:Pintura={slots:new Uint8Array(),detalhes:new Map()},historico=new Historico(),traco:Map<number,Alteracao>|null=null;
const send=(r:Resposta,t:Transferable[]=[])=>scope.postMessage(r,t);
function renderDetalhes():DetalhesRender {
  let total=0;pintura.detalhes.forEach((n,f)=>folhas(n,triangulo(malha?.posicoes??new Float32Array(),f),()=>total++));
  const posicoes=new Float32Array(total*9),slots=new Uint8Array(total),faces=new Uint32Array(total);let i=0;
  pintura.detalhes.forEach((n,f)=>folhas(n,triangulo(malha?.posicoes??new Float32Array(),f),(slot,t)=>{for(let j=0;j<3;j++)posicoes.set(t[j]??[0,0,0],i*9+j*3);slots[i]=slot;faces[i++]=f;}));return {posicoes,slots,faces};
}
function publicar(diff:Alteracao[],trees:boolean){const faces=new Uint32Array(diff.map(d=>d.face)),slots=new Uint8Array(diff.map(d=>pintura.slots[d.face]??1)),detalhes=trees?renderDetalhes():null;send({tipo:'pintura',faces,slots,detalhes,usadas:coresUsadas(pintura),desfazer:historico.desfazer.length>0,refazer:historico.refazer.length>0});}
function pintar(select:(f:number,antes:No)=>No){if(!malha)return;const diff:Alteracao[]=[];let trees=false;for(let f=0;f<pintura.slots.length;f++){const antes=lerFace(pintura,f),depois=select(f,antes);if(antes===depois || ('slot'in antes&&'slot'in depois&&antes.slot===depois.slot))continue;trees ||= !('slot'in antes)||!('slot'in depois);escreverFace(pintura,f,depois);const d={face:f,antes,depois};diff.push(d);if(traco){const prev=traco.get(f);traco.set(f,{face:f,antes:prev?.antes??antes,depois});}}
  if(!traco)historico.registrar(diff);publicar(diff,trees);
}
scope.onmessage=(event)=>{try{const cmd=event.data;
 if(cmd.tipo==='ler'){send({tipo:'progresso',etapa:'Lendo',percentual:5});malha=prepararMalha(lerSTL(cmd.buffer),(etapa,percentual)=>send({tipo:'progresso',etapa,percentual}));send({tipo:'progresso',etapa:'Regiões',percentual:85});regioes=segmentar(malha,cmd.sensibilidade);pintura={slots:new Uint8Array(malha.indices.length/3).fill(1),detalhes:new Map()};historico=new Historico();traco=null;const posicoes=malha.posicoes.slice(),normais=malha.normais.slice();send({tipo:'malha',posicoes,normais,regioes:regioes.slice()},[posicoes.buffer,normais.buffer]);return;}
 if(!malha)throw new Error('Envie uma peça primeiro.');const m=malha;
 switch(cmd.tipo){
 case 'segmentar':send({tipo:'progresso',etapa:'Regiões',percentual:85});regioes=segmentar(m,cmd.sensibilidade);send({tipo:'regioes',regioes:regioes.slice()});break;
 case 'inicioTraco':traco=new Map();break;
 case 'fimTraco':{const diff=[...(traco?.values()??[])];traco=null;historico.registrar(diff);publicar([],false);break;}
 case 'balde':pintar((f,n)=>regioes[f]===regioes[cmd.face]?folha(cmd.slot):n);break;
 case 'pincel':pintar((f,n)=>{let d=0,dot=0;for(let k=0;k<3;k++){d+=((m.centros[f*3+k]??0)-(cmd.ponto[k]??0))**2;dot+=(m.normais[f*3+k]??0)*(cmd.camera[k]??0);}return d<=cmd.raio**2&&dot>0?folha(cmd.slot):n;});break;
 case 'sementes':{const slots=watershed(m,regioes,cmd.sementes);pintar((f,n)=>slots[f]?folha(slots[f]??1):n);break;}
 case 'forma':pintar((f,n)=>{let next=n;for(const forma of cmd.formas){let dot=0;for(let k=0;k<3;k++)dot+=(m.normais[f*3+k]??0)*(forma.camera[k]??0);if(dot>0)next=aplicarForma(triangulo(m.posicoes,f),next,forma,cmd.slot);}return next;});break;
 case 'juntar':pintar((_f,n)=>trocarSlot(n,cmd.a,cmd.b));break;
 case 'historico':{const diff=historico.voltar(pintura,cmd.refazer);publicar(diff,diff.some(d=>!('slot'in d.antes)||!('slot'in d.depois)));break;}
 case 'exportar':{const blob=exportar3mf(m,pintura,n=>send({tipo:'progresso',etapa:'Exportando',percentual:n}));send({tipo:'exportado',blob,usadas:coresUsadas(pintura)});break;}
 }
}catch(err){send({tipo:'erro',mensagem:err instanceof Error?err.message:'Não foi possível processar esta peça.'});}};
