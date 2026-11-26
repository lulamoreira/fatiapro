import type { Malha } from "./malha";
export interface AreaRegiao { id: number; area: number }
export function areasRegioes(posicoes: Float32Array, regioes: Uint32Array): AreaRegiao[] {
  const areas = new Map<number, number>();
  for (let f = 0; f < regioes.length; f++) {
    const i = f * 9, ux = (posicoes[i+3] ?? 0)-(posicoes[i] ?? 0), uy = (posicoes[i+4] ?? 0)-(posicoes[i+1] ?? 0), uz = (posicoes[i+5] ?? 0)-(posicoes[i+2] ?? 0), vx = (posicoes[i+6] ?? 0)-(posicoes[i] ?? 0), vy = (posicoes[i+7] ?? 0)-(posicoes[i+1] ?? 0), vz = (posicoes[i+8] ?? 0)-(posicoes[i+2] ?? 0);
    const id = regioes[f] ?? 0;
    areas.set(id, (areas.get(id) ?? 0) + Math.hypot(uy*vz-uz*vy, uz*vx-ux*vz, ux*vy-uy*vx)/2);
  }
  return [...areas].map(([id, area]) => ({id, area})).sort((a,b) => b.area-a.area || a.id-b.id);
}
export function escolherRegioes(areas: readonly AreaRegiao[]): AreaRegiao[] {
  const sorted = [...areas].sort((a,b) => b.area-a.area || a.id-b.id), total = sorted.reduce((s,r) => s+r.area,0), out: AreaRegiao[] = [];
  let sum = 0;
  for (const r of sorted) { if (out.length >= 60 || (out.length && sum >= total*.98)) break; out.push(r); sum += r.area; }
  return out;
}
export function herdarCores(m: Pick<Malha,"vizinhos">, regioes: Uint32Array, cores: Map<number,number>): Map<number,number> {
  const out = new Map(cores), borders = new Map<number,Map<number,number>>();
  for (let e=0;e<m.vizinhos.length;e++) { const g=m.vizinhos[e] ?? -1, a=regioes[Math.floor(e/3)], b=regioes[g]; if(g<0 || a===undefined || b===undefined || a===b) continue; const adj=borders.get(a) ?? new Map<number,number>(); adj.set(b,(adj.get(b) ?? 0)+1); borders.set(a,adj); }
  const pending = new Set(regioes);
  for (const id of out.keys()) pending.delete(id);
  // Synchronous rounds preserve largest shared edge count, with deterministic ties.
  while(pending.size) { const next: [number,number][]=[]; for(const id of pending) { const best=[...(borders.get(id) ?? [])].filter(([other])=>out.has(other)).sort((a,b)=>b[1]-a[1]||a[0]-b[0])[0]; if(best) next.push([id,out.get(best[0]) ?? 1]); } if(!next.length) break; for(const [id,slot] of next){out.set(id,slot);pending.delete(id);} }
  // Disconnected omitted shells have no neighbor: neutral first slot, never an invented match.
  for(const id of pending) out.set(id,1);
  return out;
}
/** Chamfer distance to the region boundary, including holes, not a centroid (C shapes). */
export function pontosInternos(ids: Int32Array, width: number, height: number, minimo=150): Map<number,{x:number;y:number;pixels:number}> {
  const d=new Float32Array(ids.length), counts=new Map<number,number>(), best=new Map<number,{x:number;y:number;pixels:number;d:number}>();
  for(let y=0;y<height;y++) for(let x=0;x<width;x++){const i=y*width+x,id=ids[i] ?? -1;if(id<0) continue; counts.set(id,(counts.get(id) ?? 0)+1); d[i]=x===0||y===0||x===width-1||y===height-1||ids[i-1]!==id||ids[i+1]!==id||ids[i-width]!==id||ids[i+width]!==id ? 1 : 1e9;}
  const relax=(x:number,y:number,dx:number,dy:number,c:number)=>{const i=y*width+x,j=(y+dy)*width+x+dx;if(x+dx>=0&&x+dx<width&&y+dy>=0&&y+dy<height&&ids[j]===ids[i])d[i]=Math.min(d[i] ?? 0,(d[j] ?? 0)+c);};
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){relax(x,y,-1,0,1);relax(x,y,0,-1,1);relax(x,y,-1,-1,Math.SQRT2);relax(x,y,1,-1,Math.SQRT2);}
  for(let y=height-1;y>=0;y--)for(let x=width-1;x>=0;x--){relax(x,y,1,0,1);relax(x,y,0,1,1);relax(x,y,1,1,Math.SQRT2);relax(x,y,-1,1,Math.SQRT2);const i=y*width+x,id=ids[i] ?? -1;if(id>=0&&(counts.get(id) ?? 0)>=minimo&&(d[i] ?? 0)>(best.get(id)?.d ?? -1))best.set(id,{x,y,pixels:counts.get(id) ?? 0,d:d[i] ?? 0});}
  return best;
}
