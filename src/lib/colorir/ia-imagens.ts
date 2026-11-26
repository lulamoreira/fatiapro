import { WebGLRenderer, WebGLRenderTarget, Scene, Color, Mesh, BufferGeometry, BufferAttribute, MeshStandardMaterial, MeshBasicMaterial, AmbientLight, DirectionalLight, NoToneMapping, LinearSRGBColorSpace, SRGBColorSpace } from "three";
import type { CameraIA } from "./ia-geometria";
import { cameraOrto, criarCamera, cameraRosto } from "./ia-geometria";
import { escolherRegioes, areasRegioes, pontosInternos } from "./ia-regioes";
import { VISTAS_IA, ImagemSchema } from "./ia-schema";
import type { ImagemIA } from "./ia-schema";
import type { Vec3 } from "./pintura";
export interface ImagensGerais { foto:ImagemIA; vistas:ImagemIA[]; cameras:Record<string,CameraIA>; areas:ReturnType<typeof areasRegioes>; ids:number[] }
function imagem(canvas:HTMLCanvasElement):ImagemIA { return ImagemSchema.parse({tipo:"image/jpeg",base64:canvas.toDataURL("image/jpeg",.85).split(",")[1]??""}); }
export async function reduzirFoto(url:string):Promise<ImagemIA> {
  const photo=new Image();photo.src=url;await photo.decode();const scale=Math.min(1,1024/Math.max(photo.naturalWidth,photo.naturalHeight)),canvas=document.createElement("canvas");canvas.width=Math.max(1,Math.round(photo.naturalWidth*scale));canvas.height=Math.max(1,Math.round(photo.naturalHeight*scale));const ctx=canvas.getContext("2d");if(!ctx)throw new Error("Não foi possível preparar a foto.");ctx.drawImage(photo,0,0,canvas.width,canvas.height);return imagem(canvas);
}
function renderizador(posicoes:Float32Array,regioes:Uint32Array,size:number){
  const renderer=new WebGLRenderer({antialias:false,preserveDrawingBuffer:true});renderer.setSize(size,size);renderer.setPixelRatio(1);renderer.toneMapping=NoToneMapping;
  const scene=new Scene();scene.background=new Color("#FFFFFF");const geo=new BufferGeometry();geo.setAttribute("position",new BufferAttribute(posicoes,3));geo.computeVertexNormals();
  const standard=new MeshStandardMaterial({color:"#B8B8B8",roughness:.85}),basic=new MeshBasicMaterial({vertexColors:true,toneMapped:false}),mesh:Mesh<BufferGeometry,MeshStandardMaterial|MeshBasicMaterial>=new Mesh(geo,standard);scene.add(mesh);scene.add(new AmbientLight("#FFFFFF",1.2));const light=new DirectionalLight("#FFFFFF",2);scene.add(light);scene.add(light.target);
  const target=new WebGLRenderTarget(size,size),pixels=new Uint8Array(size*size*4);
  const draw=(camera:CameraIA,mapa=false)=>{const cam=criarCamera(camera);light.position.set(...camera.posicao);light.target.position.set(...camera.centro);light.target.updateMatrixWorld();mesh.material=mapa?basic:standard;renderer.outputColorSpace=mapa?LinearSRGBColorSpace:SRGBColorSpace;renderer.setRenderTarget(mapa?target:null);renderer.render(scene,cam);};
  return {renderer,scene,geo,draw,target,pixels,dispose:()=>{geo.dispose();standard.dispose();basic.dispose();target.dispose();renderer.dispose();renderer.forceContextLoss();}};
}
const DIRECOES:Vec3[]=[[0,-1,0],[0,1,0],[-1,0,0],[1,0,0],[Math.cos(Math.PI/6)/Math.SQRT2,-Math.cos(Math.PI/6)/Math.SQRT2,.5]];
export async function prepararImagens(posicoes:Float32Array,regioes:Uint32Array,url:string,signal:AbortSignal,onVista?:(n:number)=>void):Promise<ImagensGerais>{
  const areas=areasRegioes(posicoes,regioes),selected=escolherRegioes(areas),ids=selected.map(r=>r.id),foto=await reduzirFoto(url),vistas:ImagemIA[]=[],cameras:Record<string,CameraIA>={};
  signal.throwIfAborted();const r=renderizador(posicoes,regioes,768),attr=new Float32Array(posicoes.length),palette=ids.map((_,i)=>new Color().setHSL(((i*137.508)%360)/360,.7,.55)),idLookup=new Map(ids.map((id,i)=>[id,i+1]));
  for(let f=0;f<regioes.length;f++){const code=idLookup.get(regioes[f]??0)??0;for(let v=0;v<3;v++)attr.set([(code&255)/255,0,0],f*9+v*3);}
  r.geo.setAttribute("color",new BufferAttribute(attr,3));
  try{for(let i=0;i<VISTAS_IA.length;i++){
    signal.throwIfAborted();const name=VISTAS_IA[i],dir=DIRECOES[i];if(!name||!dir)continue;const cam=cameraOrto(posicoes,dir);cameras[name]=cam;
    const canvas=document.createElement("canvas");canvas.width=1536;canvas.height=768;const ctx=canvas.getContext("2d");if(!ctx)throw new Error("Não foi possível preparar as vistas.");r.draw(cam);ctx.drawImage(r.renderer.domElement,0,0);r.draw(cam,true);r.renderer.readRenderTargetPixels(r.target,0,0,768,768,r.pixels);
    const mask=new Int32Array(768*768).fill(-1),image=ctx.createImageData(768,768);
    for(let y=0;y<768;y++)for(let x=0;x<768;x++){const j=y*768+x,code=r.pixels[((767-y)*768+x)*4]??0,id=ids[code-1];mask[j]=id??-1;const c=code>0?palette[code-1]:null;const srgb=c?.clone().convertLinearToSRGB();image.data.set(srgb?[Math.round(srgb.r*255),Math.round(srgb.g*255),Math.round(srgb.b*255),255]:[235,235,235,255],j*4);}
    ctx.putImageData(image,768,0);ctx.font="600 18px sans-serif";ctx.textAlign="center";ctx.textBaseline="middle";ctx.lineWidth=3;ctx.strokeStyle="#FFFFFF";ctx.fillStyle="#000000";
    for(const [id,p] of pontosInternos(mask,768,768)){ctx.strokeText(String(id),768+p.x,p.y);ctx.fillText(String(id),768+p.x,p.y);}
    vistas.push(imagem(canvas));onVista?.(i+1);await new Promise<void>(resolve=>requestAnimationFrame(()=>resolve()));
  }}finally{r.dispose();}
  return {foto,vistas,cameras,areas,ids};
}
export function prepararClose(posicoes:Float32Array,regioes:Uint32Array,id:number):{imagem:ImagemIA;camera:CameraIA}{
  const camera=cameraRosto(posicoes,regioes,id),r=renderizador(posicoes,regioes,1024);
  try{r.draw(camera);return {imagem:imagem(r.renderer.domElement),camera};}finally{r.dispose();}
}
