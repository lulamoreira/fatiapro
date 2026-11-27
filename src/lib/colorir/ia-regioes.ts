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
/** `obrigatorias` (large thin lines) always enter, inside the same 60-region cap. */
export function escolherRegioes(areas: readonly AreaRegiao[], obrigatorias: ReadonlySet<number> = new Set()): AreaRegiao[] {
  const sorted = [...areas].sort((a,b) => b.area-a.area || a.id-b.id), total = sorted.reduce((s,r) => s+r.area,0), out: AreaRegiao[] = sorted.filter(r => obrigatorias.has(r.id)).slice(0, 60);
  let sum = out.reduce((s,r) => s+r.area,0);
  for (const r of sorted) { if (obrigatorias.has(r.id)) continue; if (out.length >= 60 || (out.length && sum >= total*.98)) break; out.push(r); sum += r.area; }
  return obrigatorias.size ? out.sort((a,b) => b.area-a.area || a.id-b.id) : out;
}
/**
 * Omitted regions inherit a sent neighbour's colour. With `linhas` (thin relief lines), lines never pass colour on:
 * a region touching only lines takes the commonest colour of thick regions just across those lines.
 */
export function herdarCores(m: Pick<Malha,"vizinhos"> & Partial<Pick<Malha,"posicoes"|"centros">>, regioes: Uint32Array, cores: Map<number,number>, linhas: ReadonlySet<number> = new Set()): Map<number,number> {
  if (linhas.size && m.posicoes && m.centros) return herdarSemLinhas({vizinhos:m.vizinhos,posicoes:m.posicoes,centros:m.centros},regioes,cores,linhas);
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
function herdarSemLinhas(m: Pick<Malha,"vizinhos"|"posicoes"|"centros">, regioes: Uint32Array, cores: Map<number,number>, linhas: ReadonlySet<number>): Map<number,number> {
  const out = new Map(cores), borders = new Map<number,Map<number,number>>(), entradas = new Map<number,number[]>();
  for (let e=0;e<m.vizinhos.length;e++) { const g=m.vizinhos[e] ?? -1, a=regioes[Math.floor(e/3)], b=regioes[g]; if(g<0 || a===undefined || b===undefined || a===b) continue; const adj=borders.get(a) ?? new Map<number,number>(); adj.set(b,(adj.get(b) ?? 0)+1); borders.set(a,adj); if(linhas.has(b) && !linhas.has(a)){ const l=entradas.get(a) ?? []; l.push(g); entradas.set(a,l); } }
  const pending = new Set(regioes);
  for (const id of out.keys()) pending.delete(id);
  const vizinho = (id:number) => [...(borders.get(id) ?? [])].filter(([o]) => out.has(o) && (linhas.has(id) || !linhas.has(o))).sort((a,b)=>b[1]-a[1]||a[0]-b[0])[0];
  // Across-the-line lookup: walk line faces up to 3 mm from the region, weighting thick colour hits by edge length.
  const atravessar = (id:number): number|undefined => {
    const inicio = entradas.get(id); if(!inicio) return undefined;
    const dist = new Map<number,number>(), fila: number[] = [], votos = new Map<number,number>();
    for (const f of inicio) if(!dist.has(f)){ dist.set(f,0); fila.push(f); }
    for (let i=0;i<fila.length;i++) { const f=fila[i] ?? 0, d=dist.get(f) ?? 0;
      for (let k=0;k<3;k++) { const e=f*3+k, g=m.vizinhos[e] ?? -1; if(g<0) continue; const r=regioes[g] ?? 0;
        if (linhas.has(r)) { let dd=0; for(let j=0;j<3;j++) dd+=((m.centros[f*3+j] ?? 0)-(m.centros[g*3+j] ?? 0))**2; const nd=d+Math.sqrt(dd); if(nd<=3 && nd<(dist.get(g) ?? Infinity)){ if(!dist.has(g)) fila.push(g); dist.set(g,nd); } }
        else if (r!==id) { const slot=out.get(r); if(slot!==undefined && !linhas.has(r)) { const l=Math.hypot((m.posicoes[f*9+(k%3)*3] ?? 0)-(m.posicoes[f*9+((k+1)%3)*3] ?? 0),(m.posicoes[f*9+(k%3)*3+1] ?? 0)-(m.posicoes[f*9+((k+1)%3)*3+1] ?? 0),(m.posicoes[f*9+(k%3)*3+2] ?? 0)-(m.posicoes[f*9+((k+1)%3)*3+2] ?? 0)); votos.set(slot,(votos.get(slot) ?? 0)+l); } } } }
    return [...votos].sort((a,b)=>b[1]-a[1]||a[0]-b[0])[0]?.[0];
  };
  while (pending.size) {
    let next: [number,number][] = [];
    for (const id of pending) { const best=vizinho(id); if(best) next.push([id,out.get(best[0]) ?? 1]); }
    if (!next.length) for (const id of pending) { if(linhas.has(id)) continue; const slot=atravessar(id); if(slot!==undefined) next.push([id,slot]); }
    if (!next.length) break;
    for (const [id,slot] of next) { out.set(id,slot); pending.delete(id); }
    next = [];
  }
  for (const id of pending) out.set(id,1);
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
