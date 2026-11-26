// @vitest-environment node
import { describe,it,expect } from "vitest";
import { escolherRegioes,herdarCores,pontosInternos,areasRegioes } from "./ia-regioes";
import { ciede2000,reduzirPaleta } from "./ia-cores";
import { validarGeral,validarRosto,EntradaColorir } from "./ia-schema";
import type { PropostaGeral,PropostaRosto } from "./ia-schema";
import { cameraOrto,criarAlvo,atingir,formaDePixels,conferirOlhos,cameraRosto } from "./ia-geometria";
import { prepararMalha } from "./malha";
import { montarPrevia,diferencaPintura } from "./ia-previa";
import { Historico,folhas,triangulo } from "./pintura";
import type { Vec3 } from "./pintura";
const geral:PropostaGeral={paleta:[{nome:"Pele",hex:"#F0648C"},{nome:"Vermelho",hex:"#C0392B"},{nome:"Turquesa",hex:"#2FB5BE"}],regioes:[{id:0,parte:"rosto",cor:0,confianca:.9}],dividir:[],rosto:null,avisos:[]};
const rosto=(altura=30):PropostaRosto=>({sobrancelha_y:100,boca_y:200,olhos:[{cx:400,cy:140,largura:30,altura,rotacao:0,cor:0},{cx:600,cy:140,largura:30,altura,rotacao:0,cor:0}],boca:null,avisos:[]});
function plano45(){const p:number[]=[],s=Math.SQRT1_2;for(let i=0;i<80;i++)for(let j=0;j<80;j++){const x=-5+i*.125,y=-5+j*.125,d=.125;const v=(x:number,y:number):Vec3=>[x,y*s,y*s];p.push(...v(x,y),...v(x+d,y),...v(x+d,y+d),...v(x,y),...v(x+d,y+d),...v(x,y+d));}return new Float32Array(p);}
function rostoComQueixo(){const p=Array.from(plano45()),v=(t:number,f:number):Vec3=>{const a=t*Math.PI/180,b=f*Math.PI/180;return [4*Math.sin(a)*Math.cos(b),-4+4*Math.sin(a)*Math.sin(b),-4+4*Math.cos(a)];};for(let t=125;t<165;t+=5)for(let f=-125;f<-55;f+=5){const a=v(t,f),b=v(t+5,f),c=v(t+5,f+5),d=v(t,f+5);p.push(...a,...b,...c,...a,...c,...d);}return new Float32Array(p);}
describe("regiões para IA",()=>{
 it("cobre 98% antes de excluir as menores",()=>{const a=[{id:0,area:50},{id:1,area:48},{id:2,area:2}];expect(escolherRegioes(a).map(r=>r.id)).toEqual([0,1]);});
 it("envia no máximo 60 regiões",()=>{expect(escolherRegioes(Array.from({length:100},(_,id)=>({id,area:1})))).toHaveLength(60);});
 it("excluída herda da vizinha com mais arestas",()=>{const r=new Uint32Array([0,1,2]),v=new Int32Array([2,-1,-1,2,2,-1,0,1,1]);expect(herdarCores({vizinhos:v},r,new Map([[0,2],[1,3]])).get(2)).toBe(3);});
 it("propaga a herança por regiões omitidas sem tocar nas enviadas",()=>{const r=new Uint32Array([0,1,2]),v=new Int32Array([1,-1,-1,0,2,-1,1,-1,-1]);expect([...herdarCores({vizinhos:v},r,new Map([[0,4]]))]).toEqual([[0,4],[1,4],[2,4]]);});
 it("número fica dentro de região C, não no buraco",()=>{const w=40,h=40,ids=new Int32Array(w*h).fill(-1);for(let y=4;y<36;y++)for(let x=4;x<36;x++)if(x<12||y<12||y>28)ids[y*w+x]=7;const p=pontosInternos(ids,w,h).get(7);expect(p).toBeDefined();if(!p)throw new Error();expect(ids[p.y*w+p.x]).toBe(7);expect(p.pixels).toBeGreaterThan(150);});
 it("esconde números com menos de 150 pixels visíveis",()=>{expect(pontosInternos(new Int32Array(100).fill(0),10,10).size).toBe(0);});
});
describe("validação das propostas",()=>{
 it("aceita todos os ids enviados uma vez",()=>expect(validarGeral(geral,[0])).toEqual(geral));
 it("rejeita id inexistente",()=>expect(()=>validarGeral({...geral,regioes:[{...geral.regioes[0],id:5}]},[0])).toThrow());
 it("rejeita região enviada sem resposta",()=>expect(()=>validarGeral(geral,[0,1])).toThrow());
 it("rejeita cor fora da paleta",()=>expect(()=>validarGeral({...geral,regioes:[{id:0,parte:"rosto",cor:3,confianca:1}]},[0])).toThrow());
 it("rejeita coordenada x maior que 1",()=>expect(()=>validarGeral({...geral,dividir:[{id:0,motivo:"duas partes",sementes:[{vista:"frente",x:1.1,y:.5,cor:0},{vista:"frente",x:.3,y:.5,cor:1}]}]},[0])).toThrow());
 it("rejeita cor de olho fora da paleta",()=>expect(()=>validarRosto(rosto(),0)).toThrow());
 it("rejeita pixel fora do close",()=>expect(()=>validarRosto({...rosto(),boca_y:1025},3)).toThrow());
 it("rejeita imagem falsa antes de cobrar",()=>expect(()=>EntradaColorir.parse({chave:crypto.randomUUID(),etapa:"geral",nome:"peça",slots:4,ids:[0],imagens:Array(6).fill({tipo:"image/jpeg",base64:"AAAA"})})).toThrow());
});
describe("olhos e cores",()=>{
 it("proporção 0,10 reprova",()=>expect(conferirOlhos(rosto(10))).toBe(false));
 it("proporção 0,30 aprova",()=>expect(conferirOlhos(rosto(30))).toBe(true));
 it("olhos 20% diferentes reprovam",()=>{const p=rosto();const o=p.olhos[1];if(!o)throw new Error();o.largura=36;expect(conferirOlhos(p)).toBe(false);});
 it("CIEDE2000 aproxima rosa ao vermelho antes do turquesa",()=>expect(ciede2000("#F0648C","#C0392B")).toBeLessThan(ciede2000("#F0648C","#2FB5BE")));
 it("junta a cor menos usada pela distância e mantém no máximo N",()=>{const p={...geral,regioes:[{id:0,parte:"rosa",cor:0,confianca:1},{id:1,parte:"vermelho",cor:1,confianca:1},{id:2,parte:"turquesa",cor:2,confianca:1}]};const r=reduzirPaleta(p,[{id:0,area:1},{id:1,area:20},{id:2,area:30}],2);expect(r.fusoes).toEqual([{origem:0,destino:1}]);expect(r.mapa).toEqual([1,1,2]);});
 it("respeita destino escolhido pelo usuário",()=>{const r=reduzirPaleta(geral,[{id:0,area:0}],2,[{origem:0,destino:2}]);expect(r.fusoes[0]).toEqual({origem:0,destino:2});});
});
describe("câmera e prévia",()=>{
 it("coordenada central vira raio e atinge face frontal do cubo",()=>{const p=new Float32Array([-1,-1,-1,1,-1,-1,1,-1,1,-1,-1,-1,1,-1,1,-1,-1,1,-1,1,-1,1,1,1,1,1,-1,-1,1,-1,-1,1,1,1,1,1]);const cam=cameraOrto(p,[0,-1,0]);const alvo=criarAlvo(p);try{const hit=atingir(cam,.5,.5,alvo.mesh);expect(hit?.face).toBeLessThan(2);expect(hit?.ponto[1]).toBeCloseTo(-1,6);}finally{alvo.dispose();}});
 it("close normal ao plano de 45°: px→mm, centro na superfície e oval com erro <2%",()=>{const p=plano45(),camera=cameraRosto(p,new Uint32Array(p.length/9),0),alvo=criarAlvo(p);try{const f=formaDePixels(camera,alvo.mesh,p,{cx:512,cy:512,largura:2.7/camera.mm_por_px,altura:3.4/camera.mm_por_px},"oval");expect(f).not.toBeNull();if(!f)throw new Error();expect(f.centro[1]).toBeCloseTo(f.centro[2],5);expect(f.largura).toBeCloseTo(2.7,8);let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;const {aplicarForma,projetar}=requireFormas;for(let i=0;i<p.length/9;i++){const t=triangulo(p,i);folhas(aplicarForma(t,{slot:1},f,2),t,(slot,tri)=>{if(slot===2)for(const v of tri){const [x,y]=projetar(v,f);minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);}});}expect(Math.abs(maxX-minX-2.7)/2.7).toBeLessThan(.02);expect(Math.abs(maxY-minY-3.4)/3.4).toBeLessThan(.02);}finally{alvo.dispose();}});
 it("close ignora a calota do queixo e converge para a face principal inclinada 45°",()=>{const p=rostoComQueixo(),camera=cameraRosto(p,new Uint32Array(p.length/9),0),normal=new Vector3(...camera.direcao).normalize(),principal=new Vector3(0,-1,1).normalize();expect(normal.angleTo(principal)*180/Math.PI).toBeLessThan(8);});
 it("curvatura positiva coloca o centro do sorriso abaixo das pontas na superfície",()=>{const p=plano45(),camera=cameraRosto(p,new Uint32Array(p.length/9),0),alvo=criarAlvo(p);try{const f=formaDePixels(camera,alvo.mesh,p,{cx:512,cy:512,largura:4/camera.mm_por_px,curvatura:.6/camera.mm_por_px,espessura:.2/camera.mm_por_px},"sorriso");expect(f).not.toBeNull();if(!f)throw new Error();const centro=requireFormas.projetar([f.centro[0]-f.cima[0]*f.curvatura,f.centro[1]-f.cima[1]*f.curvatura,f.centro[2]-f.cima[2]*f.curvatura],f),esquerda=requireFormas.projetar([f.centro[0]-f.direita[0]*f.largura/2,f.centro[1]-f.direita[1]*f.largura/2,f.centro[2]-f.direita[2]*f.largura/2],f),direita=requireFormas.projetar([f.centro[0]+f.direita[0]*f.largura/2,f.centro[1]+f.direita[1]*f.largura/2,f.centro[2]+f.direita[2]*f.largura/2],f);expect(centro[1]).toBeLessThan(esquerda[1]);expect(centro[1]).toBeLessThan(direita[1]);}finally{alvo.dispose();}});
 it("Descartar não altera a pintura e Aplicar é um passo reversível",()=>{const m=prepararMalha(new Float32Array([0,0,0,1,0,0,0,1,0])),p={slots:new Uint8Array([1]),detalhes:new Map()},r=new Uint32Array([0]),proposta=montarPrevia(m,r,p,{regioes:[{id:0,slot:3}],sementes:[],formas:[]});expect([...p.slots]).toEqual([1]);expect([...proposta.slots]).toEqual([3]);const h=new Historico();h.registrar(diferencaPintura(p,proposta));expect(h.desfazer).toHaveLength(1);h.voltar(proposta);expect([...proposta.slots]).toEqual([1]);h.voltar(proposta,true);expect([...proposta.slots]).toEqual([3]);});
 it("calcula área real, não quantidade de triângulos",()=>expect(areasRegioes(new Float32Array([0,0,0,2,0,0,0,3,0]),new Uint32Array([0]))).toEqual([{id:0,area:3}]));
});
import * as requireFormas from "./formas";
import { Vector3 } from "three";
