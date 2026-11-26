// @vitest-environment node
import { describe,it,expect,vi,afterEach } from "vitest";
import type { Comando,Resposta } from "./protocolo";
import type { CorSlot } from "./paleta";
afterEach(()=>vi.unstubAllGlobals());
async function worker(){
  vi.resetModules();const mensagens:Resposta[]=[],scope:{postMessage:(r:Resposta)=>void;onmessage:((e:{data:Comando})=>void)|null}={postMessage:r=>mensagens.push(r),onmessage:null};vi.stubGlobal("self",scope);await import("./colorir.worker");
  const enviar=(cmd:Comando)=>{mensagens.length=0;scope.onmessage?.({data:cmd});return [...mensagens];};
  const raw="solid t\nfacet normal 0 0 1\nouter loop\nvertex 0 0 0\nvertex 10 0 0\nvertex 0 10 0\nendloop\nendfacet\nendsolid t";
  enviar({tipo:"ler",buffer:new TextEncoder().encode(raw).buffer,sensibilidade:6});return {enviar};
}
const antes:CorSlot[]=[{nome:"Original",cor:"#FFFFFF"}],depois:CorSlot[]=[{nome:"IA",cor:"#C0392B"}];
describe("prévia no worker real",()=>{
 it("Descartar não modifica pintura exportada e não cria histórico",async()=>{const {enviar}=await worker();enviar({tipo:"previaIA",plano:{regioes:[{id:0,slot:2}],sementes:[],formas:[]},semRosto:false});enviar({tipo:"descartarIA"});const r=enviar({tipo:"exportar"}).find(r=>r.tipo==="exportado");expect(r?.tipo).toBe("exportado");if(r?.tipo!=="exportado")throw new Error();expect(r.usadas).toEqual([1]);const h=enviar({tipo:"historico",refazer:false}).find(r=>r.tipo==="pintura");if(h?.tipo!=="pintura")throw new Error();expect(h.desfazer).toBe(false);expect(h.refazer).toBe(false);});
 it("Aplicar gera um único desfazer e restaura nomes/cores da paleta",async()=>{const {enviar}=await worker();enviar({tipo:"previaIA",plano:{regioes:[{id:0,slot:2}],sementes:[],formas:[]},semRosto:false});enviar({tipo:"aplicarIA",paletaAntes:antes,paletaDepois:depois});const undo=enviar({tipo:"historico",refazer:false}).find(r=>r.tipo==="pintura");if(undo?.tipo!=="pintura")throw new Error();expect(undo.usadas).toEqual([1]);expect(undo.paleta).toEqual(antes);expect(undo.desfazer).toBe(false);expect(undo.refazer).toBe(true);const redo=enviar({tipo:"historico",refazer:true}).find(r=>r.tipo==="pintura");if(redo?.tipo!=="pintura")throw new Error();expect(redo.usadas).toEqual([2]);expect(redo.paleta).toEqual(depois);});
 it("mudança só da paleta também pode ser desfeita em um passo",async()=>{const {enviar}=await worker();enviar({tipo:"previaIA",plano:{regioes:[{id:0,slot:1}],sementes:[],formas:[]},semRosto:true});const a=enviar({tipo:"aplicarIA",paletaAntes:antes,paletaDepois:depois}).find(r=>r.tipo==="pintura");if(a?.tipo!=="pintura")throw new Error();expect(a.desfazer).toBe(true);const r=enviar({tipo:"historico",refazer:false}).find(r=>r.tipo==="pintura");if(r?.tipo!=="pintura")throw new Error();expect(r.paleta).toEqual(antes);expect(r.desfazer).toBe(false);});
});
