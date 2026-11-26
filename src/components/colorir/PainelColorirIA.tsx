import { Sparkles, X, Check, EyeOff } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { useColorirIA } from "./useColorirIA";
export interface PainelColorirIAProps { ia:ReturnType<typeof useColorirIA>; habilitado:boolean; ocupado:boolean; onAplicar:()=>void; onSelecionar:(id:number)=>void }
export function PainelColorirIA({ia,habilitado,ocupado,onAplicar,onSelecionar}:PainelColorirIAProps){
  return <section className="space-y-3 border-t border-border pt-4">
    {!ia.proposta&&<><Button variant="outline" className="w-full" disabled={!habilitado||!!ia.etapa||ocupado} onClick={ia.pedir}><Sparkles/>Colorir pela foto (IA)</Button><p className="text-xs text-muted-foreground">Custa 1 crédito · Saldo: <span className="tabular-nums">{ia.saldo??"…"}</span></p></>}
    {ia.etapa&&<div className="space-y-2" role="status"><p className="text-sm font-medium">{ia.etapa}…</p><Button variant="outline" size="sm" onClick={()=>{if(ia.proposta)ia.descartar();else void ia.cancelar();}}><X/>Cancelar</Button></div>}
    {ia.erro&&!ia.proposta&&<div className="space-y-2 text-sm" role="alert"><p>{ia.erro.mensagem}</p>{ia.erro.codigo==="sem_creditos"&&<Button asChild variant="outline" size="sm"><Link to="/app/plano">Ver planos</Link></Button>}</div>}
    {ia.proposta&&ia.montagem&&<>
      <h2 className="flex items-center gap-2 text-sm font-semibold"><Sparkles className="size-4 text-primary-ink"/>Prévia da IA</h2>
      <div className="space-y-2">{ia.proposta.geral.paleta.map((c,i)=><div key={i} className="flex min-w-0 items-center gap-2"><input type="color" value={c.hex} aria-label={`Cor sugerida ${i+1}`} className="h-8 w-8 shrink-0 cursor-pointer rounded border border-border bg-card" onChange={e=>ia.editarCor(i,{nome:c.nome,cor:e.target.value})}/><Input value={c.nome} aria-label={`Nome da cor sugerida ${i+1}`} onChange={e=>ia.editarCor(i,{nome:e.target.value.slice(0,40),cor:c.hex})}/></div>)}</div>
      <div className="space-y-1">{ia.proposta.geral.regioes.map(r=><Button key={r.id} variant="ghost" size="sm" className={cn("h-auto w-full justify-start whitespace-normal text-left",r.confianca<.6&&"bg-warning/15 text-warning-ink",ia.selecionada===r.id&&"ring-1 ring-primary")} onClick={()=>onSelecionar(r.id)}>{r.parte} → {ia.montagem?.paleta[(ia.montagem?.reducao.mapa[r.cor]??1)-1]?.nome??"Cor"}{r.confianca<.6&&" · conferir"}</Button>)}</div>
      {ia.montagem.reducao.fusoes.map(f=><label key={f.origem} className="block space-y-1 text-xs text-muted-foreground"><span>{ia.proposta?.geral.paleta[f.origem]?.nome} → {ia.proposta?.geral.paleta[f.destino]?.nome}</span><select aria-label={`Destino de ${ia.proposta?.geral.paleta[f.origem]?.nome}`} className="w-full rounded border border-border bg-card p-2 text-foreground" value={f.destino} onChange={e=>ia.setFusoes(old=>[...old.filter(v=>v.origem!==f.origem),{origem:f.origem,destino:Number(e.target.value)}])}>{ia.montagem?.reducao.ativas.map(i=><option key={i} value={i}>{ia.proposta?.geral.paleta[i]?.nome}</option>)}</select></label>)}
      {ia.montagem.avisos.length>0&&<ul className="space-y-2 text-xs text-muted-foreground">{ia.montagem.avisos.map((a,i)=><li key={`${i}-${a}`}>{a}</li>)}</ul>}
      <Button className="w-full" variant="outline" disabled={ocupado||!!ia.etapa} onClick={onAplicar}><Check/>Aplicar</Button>
      <Button className="w-full" variant="outline" disabled={ocupado||!!ia.etapa} aria-pressed={ia.semRosto} onClick={()=>ia.setSemRosto(true)}><EyeOff/>Só cores, sem olhos/boca</Button>
      <Button className="w-full" variant="ghost" onClick={ia.descartar}><X/>Descartar</Button>
    </>}
    <Dialog open={ia.consentimento} onOpenChange={ia.setConsentimento}><DialogContent><DialogHeader><DialogTitle>Colorir pela foto</DialogTitle><DialogDescription>Para colorir pela foto, enviamos à nossa IA (Anthropic) a sua foto de referência e imagens geradas da peça, só para esta análise. Nada fica guardado nos nossos servidores.</DialogDescription></DialogHeader><DialogFooter><Button variant="outline" onClick={()=>ia.setConsentimento(false)}>Cancelar</Button><Button onClick={ia.aceitar}>Enviar e colorir</Button></DialogFooter></DialogContent></Dialog>
  </section>;
}
