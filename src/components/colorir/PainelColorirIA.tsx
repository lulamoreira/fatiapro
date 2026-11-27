import { useEffect, useState } from "react";
import type { Ref } from "react";
import { Sparkles, X, Check, EyeOff, Loader2, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { useColorirIA } from "./useColorirIA";
export interface PainelColorirIAProps { ia:ReturnType<typeof useColorirIA>; habilitado:boolean; ocupado:boolean; onAplicar:()=>void; onSelecionar:(id:number)=>void; painelRef?:Ref<HTMLElement>; destaque?:boolean; n?:number }
export function PainelColorirIA({ia,habilitado,ocupado,onAplicar,onSelecionar,painelRef,destaque,n}:PainelColorirIAProps){
  return <section ref={painelRef} className={cn("scroll-mt-4 space-y-3 rounded-xl border-t border-border pt-4 transition-shadow",destaque&&"ring-2 ring-primary ring-offset-2 ring-offset-background")}>
    {!ia.proposta&&<><Button variant="outline" className="w-full" disabled={!habilitado||!!ia.etapa||ocupado} onClick={ia.pedir}>{ia.etapa?<Loader2 className="animate-spin"/>:<Sparkles/>}Colorir pela foto (IA)</Button><p className="text-xs text-muted-foreground">Custa 1 crédito · Saldo: <span className="tabular-nums">{ia.saldo??"…"}</span></p></>}
    {ia.erro&&!ia.proposta&&<div className="space-y-2 text-sm" role="alert"><p>{ia.erro.mensagem}</p>{ia.erro.codigo==="sem_creditos"&&<Button asChild variant="outline" size="sm"><Link to="/app/plano">Ver planos</Link></Button>}</div>}
    {ia.proposta&&ia.montagem&&<>
      <h2 className="flex items-center gap-2 text-sm font-semibold"><Sparkles className="size-4 text-primary-ink"/>Prévia da IA</h2>
      <div className="space-y-2">{ia.proposta.geral.paleta.map((c,i)=><div key={i} className="flex min-w-0 items-center gap-2"><input type="color" value={c.hex} aria-label={`Cor sugerida ${i+1}`} className="h-8 w-8 shrink-0 cursor-pointer rounded border border-border bg-card" onChange={e=>ia.editarCor(i,{nome:c.nome,cor:e.target.value})}/><Input value={c.nome} aria-label={`Nome da cor sugerida ${i+1}`} onChange={e=>ia.editarCor(i,{nome:e.target.value.slice(0,40),cor:c.hex})}/></div>)}</div>
      <div className="space-y-1">{ia.proposta.geral.regioes.map(r=><Button key={r.id} variant="ghost" size="sm" className={cn("h-auto w-full justify-start whitespace-normal text-left",r.confianca<.6&&"bg-warning/15 text-warning-ink",ia.selecionada===r.id&&"ring-1 ring-primary")} onClick={()=>onSelecionar(r.id)}>{r.parte} → {ia.montagem?.paleta[(ia.montagem?.reducao.mapa[r.cor]??1)-1]?.nome??"Cor"}{r.confianca<.6&&" · conferir"}</Button>)}</div>
      {ia.montagem.reducao.fusoes.length>0&&<p className="text-xs font-medium">A IA usou {ia.proposta.geral.paleta.length} cores; juntamos para caber em {n??ia.montagem.paleta.length}</p>}
      {ia.montagem.reducao.fusoes.map(f=><label key={f.origem} className="block space-y-1 text-xs text-muted-foreground"><span>{ia.proposta?.geral.paleta[f.origem]?.nome} → {ia.proposta?.geral.paleta[f.destino]?.nome}</span><select aria-label={`Destino de ${ia.proposta?.geral.paleta[f.origem]?.nome}`} className="w-full rounded border border-border bg-card p-2 text-foreground" value={f.destino} onChange={e=>ia.setFusoes(old=>[...old.filter(v=>v.origem!==f.origem),{origem:f.origem,destino:Number(e.target.value)}])}>{ia.montagem?.reducao.ativas.map(i=><option key={i} value={i}>{ia.proposta?.geral.paleta[i]?.nome}</option>)}</select></label>)}
      {ia.montagem.avisos.length>0&&<ul className="space-y-2 text-xs text-muted-foreground">{ia.montagem.avisos.map((a,i)=><li key={`${i}-${a}`}>{a}</li>)}</ul>}
      <Button className="w-full" variant="outline" disabled={ocupado||!!ia.etapa} onClick={onAplicar}><Check/>Aplicar</Button>
      <Button className="w-full" variant="outline" disabled={ocupado||!!ia.etapa} aria-pressed={ia.semRosto} onClick={()=>ia.setSemRosto(true)}><EyeOff/>Só cores, sem olhos/boca</Button>
      <Button className="w-full" variant="ghost" onClick={ia.descartar}><X/>Descartar</Button>
    </>}
    <Dialog open={ia.consentimento} onOpenChange={ia.setConsentimento}><DialogContent><DialogHeader><DialogTitle>Colorir pela foto</DialogTitle><DialogDescription>Para colorir pela foto, enviamos à nossa IA (Anthropic) a sua foto de referência e imagens geradas da peça, só para esta análise. Nada fica guardado nos nossos servidores.</DialogDescription></DialogHeader><DialogFooter><Button variant="outline" onClick={()=>ia.setConsentimento(false)}>Cancelar</Button><Button onClick={ia.aceitar}>Enviar e colorir</Button></DialogFooter></DialogContent></Dialog>
  </section>;
}

type IA = ReturnType<typeof useColorirIA>;
/** Display names, in order; stage 3 is skipped when the AI found no face. */
const ETAPAS = [["Preparando imagens","Preparando imagens da peça"],["IA analisando as cores","IA analisando as cores"],["IA analisando o rosto","IA analisando o rosto"],["Montando a prévia","Montando a prévia"]] as const;
export function etapaInfo(etapa:string, temRosto:boolean){
  const lista=ETAPAS.filter(e=>temRosto||e[0]!=="IA analisando o rosto");
  const i=Math.max(0,lista.findIndex(e=>e[0]===etapa));
  return {nome:lista[i]?.[1]??etapa,numero:i+1,total:lista.length,percentual:Math.round(((i+0.5)/lista.length)*100)};
}
export function mmss(ms:number){const s=Math.max(0,Math.floor(ms/1000));return `${String(Math.floor(s/60)).padStart(2,"0")}:${String(s%60).padStart(2,"0")}`;}
function Tempo({inicio}:{inicio:number|null}){
  const [agora,setAgora]=useState(()=>Date.now());
  useEffect(()=>{const t=setInterval(()=>setAgora(Date.now()),1000);return()=>clearInterval(t);},[]);
  return <span className="tabular-nums">{mmss(inicio?agora-inicio:0)}</span>;
}
export interface FaixaIAProps { ia:Pick<IA,"etapa"|"inicio"|"temRosto"|"pronta"|"erro"|"montagem"|"proposta"|"cancelar"|"descartar"|"setSemRosto"|"semRosto"|"limparErro">; ocupado:boolean; onAplicar:()=>void }
/** Banner pinned over the 3D view: progress, ready preview or error. */
export function FaixaIA({ia,ocupado,onAplicar}:FaixaIAProps){
  const base=cn("absolute inset-x-2 z-10 max-h-[25%] overflow-y-auto rounded-xl border p-3 text-sm shadow-lg backdrop-blur",ia.proposta&&!ia.etapa?"top-10":"top-2");
  if(ia.etapa){const e=etapaInfo(ia.etapa,ia.temRosto);
    return <div role="status" aria-live="polite" className={cn(base,"border-border bg-card/95 text-foreground")}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1"><Loader2 className="size-4 shrink-0 animate-spin text-primary-ink"/><span className="font-semibold">{e.nome}</span><span className="text-muted-foreground">Etapa {e.numero} de {e.total}</span><Tempo inicio={ia.inicio}/>
        <Button variant="outline" size="sm" className="ml-auto" onClick={()=>{if(ia.proposta)ia.descartar();else void ia.cancelar();}}><X/>Cancelar</Button></div>
      <Progress value={e.percentual} className="mt-2 h-1.5" aria-label="Andamento da IA"/>
      <p className="mt-1 text-xs text-muted-foreground">Leva de 30 s a 2 min. Pode continuar nesta tela.</p>
    </div>;}
  if(ia.pronta&&ia.montagem) return <div role="status" aria-live="polite" className={cn(base,"border-success/40 bg-success/15 text-foreground")}>
    <p className="flex items-center gap-2 font-semibold"><CheckCircle2 className="size-4 shrink-0 text-success"/>Prévia da IA pronta — nada foi alterado ainda</p>
    <div className="mt-2 flex flex-wrap gap-2"><Button size="sm" disabled={ocupado} onClick={onAplicar}><Check/>Aplicar</Button><Button size="sm" variant="outline" disabled={ocupado} aria-pressed={ia.semRosto} onClick={()=>ia.setSemRosto(true)}><EyeOff/>Só cores (sem olhos/boca)</Button><Button size="sm" variant="ghost" onClick={ia.descartar}><X/>Descartar</Button></div>
    {ia.montagem.avisos.length>0&&<ul className="mt-2 space-y-1 text-xs">{ia.montagem.avisos.map((a,i)=><li key={`${i}-${a}`} className="flex gap-1.5"><AlertTriangle className="size-3.5 shrink-0 text-warning-ink"/>{a}</li>)}</ul>}
  </div>;
  if(ia.erro&&!ia.proposta) return <div role="alert" className={cn(base,"border-destructive/40 bg-destructive/15 text-foreground")}>
    <div className="flex flex-wrap items-center gap-2"><AlertTriangle className="size-4 shrink-0 text-destructive"/><span className="font-medium">{ia.erro.mensagem}</span>
      {ia.erro.codigo==="sem_creditos"&&<Button asChild variant="outline" size="sm"><Link to="/app/plano">Ver planos</Link></Button>}
      <Button variant="ghost" size="icon" className="ml-auto size-7" aria-label="Fechar aviso" onClick={ia.limparErro}><X/></Button></div>
  </div>;
  return null;
}
