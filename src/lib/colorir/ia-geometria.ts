import { Box3, Vector2, Vector3, OrthographicCamera, Raycaster, BufferGeometry, BufferAttribute, Mesh, MeshBasicMaterial, DoubleSide } from "three";
import { acceleratedRaycast } from "three-mesh-bvh";
import { restaurarBVH } from "./bvh";
import type { SerializedBVH } from "three-mesh-bvh";
import { planoDaSuperficie } from "./formas";
import type { Forma } from "./formas";
import type { Vec3 } from "./pintura";
import type { PropostaRosto } from "./ia-schema";
export interface CameraIA { posicao:Vec3; direcao:Vec3; cima:Vec3; direita:Vec3; centro:Vec3; largura:number; altura:number; zoom:number; mm_por_px:number }
export function cameraOrto(posicoes:Float32Array,direcao:Vec3,pixels=768,margem=.15):CameraIA {
  const bounds=new Box3();for(let i=0;i<posicoes.length;i+=3)bounds.expandByPoint(new Vector3(posicoes[i]??0,posicoes[i+1]??0,posicoes[i+2]??0));
  if(bounds.isEmpty())throw new Error("Região vazia.");
  const centro=bounds.getCenter(new Vector3()),dir=new Vector3(...direcao).normalize(),up=Math.abs(dir.z)>.99?new Vector3(0,1,0):new Vector3(0,0,1),right=new Vector3().crossVectors(up,dir).normalize(),cima=new Vector3().crossVectors(dir,right).normalize();
  let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;
  for(let i=0;i<posicoes.length;i+=3){const v=new Vector3(posicoes[i]??0,posicoes[i+1]??0,posicoes[i+2]??0).sub(centro),x=v.dot(right),y=v.dot(cima);minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);}
  centro.addScaledVector(right,(minX+maxX)/2).addScaledVector(cima,(minY+maxY)/2);
  const size=Math.max(maxX-minX,maxY-minY,.01)*(1+2*margem),distance=Math.max(bounds.getSize(new Vector3()).length()*2,10);
  return {posicao:centro.clone().addScaledVector(dir,distance).toArray() as Vec3,direcao:dir.toArray() as Vec3,cima:cima.toArray() as Vec3,direita:right.toArray() as Vec3,centro:centro.toArray() as Vec3,largura:size,altura:size,zoom:1,mm_por_px:size/pixels};
}
export function criarCamera(c:CameraIA):OrthographicCamera {
  const cam=new OrthographicCamera(-c.largura/2,c.largura/2,c.altura/2,-c.altura/2,.01,1e9);cam.position.set(...c.posicao);cam.up.set(...c.cima);cam.zoom=c.zoom;cam.lookAt(...c.centro);cam.updateProjectionMatrix();cam.updateMatrixWorld();return cam;
}
export function raioDaVista(c:CameraIA,x:number,y:number){const r=new Raycaster();r.setFromCamera(new Vector2(x*2-1,1-y*2),criarCamera(c));r.firstHitOnly=true;return r;}
export function criarAlvo(posicoes:Float32Array,bvh:SerializedBVH|null=null){const geo=new BufferGeometry();geo.setAttribute("position",new BufferAttribute(posicoes,3));restaurarBVH(geo,bvh);const mat=new MeshBasicMaterial({side:DoubleSide}),mesh=new Mesh(geo,mat);mesh.raycast=acceleratedRaycast;mesh.updateMatrixWorld();return {mesh,dispose:()=>{geo.dispose();mat.dispose();}};}
export function atingir(c:CameraIA,x:number,y:number,mesh:Mesh){const hit=raioDaVista(c,x,y).intersectObject(mesh,false)[0];return hit&&hit.faceIndex!=null?{face:hit.faceIndex,ponto:hit.point.toArray() as Vec3}:null;}
export function conferirOlhos(p:PropostaRosto):boolean {
  if(p.olhos.length!==2||p.boca_y<=p.sobrancelha_y)return false;
  if(p.olhos.some(o=>o.altura/(p.boca_y-p.sobrancelha_y)<.15||o.altura/(p.boca_y-p.sobrancelha_y)>.50))return false;
  const [a,b]=p.olhos;if(!a||!b)return false;
  return Math.max(a.largura,b.largura)/Math.min(a.largura,b.largura)<=1.15&&Math.max(a.altura,b.altura)/Math.min(a.altura,b.altura)<=1.15;
}
export function formaDePixels(c:CameraIA,mesh:Mesh,posicoes:Float32Array,o:{cx:number;cy:number;largura:number;altura?:number;rotacao?:number;curvatura?:number;espessura?:number},tipo:"oval"|"sorriso"):Forma|null {
  const hit=atingir(c,o.cx/1024,o.cy/1024,mesh);if(!hit)return null;
  const f:Forma={tipo,centro:hit.ponto,direita:c.direita,cima:c.cima,camera:c.direcao,largura:o.largura*c.mm_por_px,altura:(o.altura??Math.max(Math.abs(o.curvatura??0)*2,o.espessura??1))*c.mm_por_px,rotacao:o.rotacao??0,curvatura:(o.curvatura??0)*c.mm_por_px,espessura:(o.espessura??1)*c.mm_por_px};
  return planoDaSuperficie(posicoes,f,{camera:c.direcao,direita:c.direita,cima:c.cima});
}
export function cameraRosto(posicoes:Float32Array,regioes:Uint32Array,id:number):CameraIA {
  const faces:number[]=[];for(let f=0;f<regioes.length;f++)if(regioes[f]===id)faces.push(f);
  if(!faces.length)throw new Error("Rosto não encontrado.");const p=new Float32Array(faces.length*9);faces.forEach((f,i)=>p.set(posicoes.subarray(f*9,f*9+9),i*9));
  const normais:Vector3[]=[];
  for(let f=0;f<p.length;f+=9){
    const a=new Vector3(p[f]??0,p[f+1]??0,p[f+2]??0),b=new Vector3(p[f+3]??0,p[f+4]??0,p[f+5]??0),c=new Vector3(p[f+6]??0,p[f+7]??0,p[f+8]??0);
    // O comprimento do produto vetorial é o dobro da área: somá-lo pondera cada face por área.
    const n=new Vector3().subVectors(b,a).cross(new Vector3().subVectors(c,a));if(n.lengthSq()>0)normais.push(n);
  }
  if(!normais.length)throw new Error("Rosto sem superfície.");
  const soma=(filtrar:boolean,base:Vector3)=>{const total=new Vector3();for(const n of normais)if(!filtrar||n.clone().normalize().dot(base)>.5)total.add(n);return total.lengthSq()>0?total.normalize():base;};
  let normal=soma(false,new Vector3());
  // O queixo e outras bordas deixam de puxar a câmera para baixo após as iterações.
  for(let i=0;i<4;i++)normal=soma(true,normal);
  return cameraOrto(p,normal.toArray() as Vec3,1024,.15);
}
