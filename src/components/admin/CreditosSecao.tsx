import { useState } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  adminAjustarCreditos, adminCreditosUsuario, adminDarCortesia, adminDarCreditos, adminEncerrarCortesia, adminReiniciarTeste,
} from "@/lib/admin-cobranca.functions";
import { ORIGEM_LOTE, descricaoMovimento } from "@/lib/plano";
import { Segmented, Tag } from "@/components/fatia/Chip";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type Form = "dar" | "ajustar" | "cortesia" | null;
type Confirma = "encerrar" | "reiniciar" | null;
const dt = (iso: string) => new Date(iso).toLocaleDateString("pt-BR");

/** "Créditos e cortesia" block of the admin user panel. All writes go through guarded server functions. */
export function CreditosSecao({ alvo }: { alvo: string }) {
  const qc = useQueryClient();
  const [pagina, setPagina] = useState(1);
  const [form, setForm] = useState<Form>(null);
  const [confirma, setConfirma] = useState<Confirma>(null);
  const ler = useServerFn(adminCreditosUsuario);
  const fns = {
    dar: useServerFn(adminDarCreditos), ajustar: useServerFn(adminAjustarCreditos), cortesia: useServerFn(adminDarCortesia),
    encerrar: useServerFn(adminEncerrarCortesia), reiniciar: useServerFn(adminReiniciarTeste),
  };
  const q = useQuery({ queryKey: ["admin", "creditos", alvo, pagina], queryFn: () => ler({ data: { id: alvo, pagina } }), placeholderData: keepPreviousData });
  const m = useMutation({
    mutationFn: (run: () => Promise<unknown>) => run(),
    onSuccess: () => { toast.success("Feito."); qc.invalidateQueries({ queryKey: ["admin"] }); qc.invalidateQueries({ queryKey: ["meu-plano"] }); setForm(null); setConfirma(null); },
    onError: (e) => toast.error((e as Error).message || "Não foi possível concluir"),
  });
  const d = q.data;
  if (!d) return <Skeleton className="h-40" />;
  const paginas = Math.max(1, Math.ceil(d.extrato_total / d.por_pagina));

  return (
    <section aria-labelledby="cred" className="space-y-3">
      <h3 id="cred" className="text-sm font-semibold">Créditos e cortesia</h3>
      <div className="flex items-end justify-between rounded-xl bg-card p-3 shadow-sm">
        <div><p className="text-xs text-muted-foreground">Saldo</p><p className="text-2xl font-bold">{d.saldo}</p></div>
        <div className="flex flex-wrap justify-end gap-2">
          <Button size="sm" onClick={() => setForm("dar")}>Dar créditos</Button>
          <Button size="sm" variant="secondary" onClick={() => setForm("ajustar")}>Ajustar créditos</Button>
          <Button size="sm" variant="secondary" onClick={() => setForm("cortesia")}>Dar cortesia de uso</Button>
        </div>
      </div>

      {d.cortesia && (
        <div className="flex items-center justify-between gap-2 rounded-xl bg-success/10 p-3 text-sm">
          <span>Cortesia ativa · {d.cortesia.por_dia} por dia{d.cortesia.premium ? " · Premium" : ""} · {d.cortesia.fim ? `até ${dt(d.cortesia.fim)}` : "sem prazo"}</span>
          <Button size="sm" variant="outline" onClick={() => setConfirma("encerrar")}>Encerrar</Button>
        </div>
      )}

      <div className="flex items-center justify-between gap-2 rounded-xl bg-card p-3 text-sm shadow-sm">
        <span>Teste grátis · {d.teste ? `${dt(d.teste.inicio)} a ${dt(d.teste.fim)}` : "nenhum"}</span>
        <Button size="sm" variant="outline" onClick={() => setConfirma("reiniciar")}>Reiniciar teste</Button>
      </div>

      {d.lotes.length > 0 && (
        <ul className="divide-y rounded-xl bg-card text-sm shadow-sm">
          {d.lotes.map((l) => (
            <li key={l.id} className="flex justify-between gap-2 px-3 py-2"><span>{ORIGEM_LOTE[l.origem] ?? l.origem}</span><span className="text-muted-foreground">{l.restante} de {l.quantidade} · {l.expira_em ? `até ${dt(l.expira_em)}` : "sem validade"}</span></li>
          ))}
        </ul>
      )}

      <div className="rounded-xl bg-card shadow-sm">
        <p className="px-3 pt-2 text-xs font-semibold text-muted-foreground">Extrato</p>
        {d.extrato.length === 0 ? <p className="p-3 text-sm text-muted-foreground">Nenhum movimento.</p> : (
          <ul className="divide-y text-sm">
            {d.extrato.map((e) => (
              <li key={e.id} className="flex justify-between gap-2 px-3 py-2">
                <span className="min-w-0"><span className="block truncate">{descricaoMovimento(e.tipo, e.jobs?.nome_peca, e.motivo)}</span>{e.motivo && e.tipo !== "reserva" && <span className="block truncate text-xs text-muted-foreground">{e.motivo}</span>}<span className="block text-xs text-muted-foreground">{dt(e.criado_em)}</span></span>
                <span className="shrink-0 font-semibold tabular">{e.quantidade > 0 ? `+${e.quantidade}` : `−${Math.abs(e.quantidade)}`}</span>
              </li>
            ))}
          </ul>
        )}
        {paginas > 1 && (
          <div className="flex items-center justify-between p-2">
            <Button size="sm" variant="ghost" disabled={pagina <= 1} onClick={() => setPagina((p) => p - 1)}>Anterior</Button>
            <span className="text-xs text-muted-foreground">{pagina} de {paginas}</span>
            <Button size="sm" variant="ghost" disabled={pagina >= paginas} onClick={() => setPagina((p) => p + 1)}>Próxima</Button>
          </div>
        )}
      </div>

      <FormDialog form={form} saldo={d.saldo} pending={m.isPending} onClose={() => setForm(null)} onSubmit={(v) => m.mutate(() =>
        v.tipo === "dar" ? fns.dar({ data: { alvo, qtd: v.qtd, validade_dias: v.validade, motivo: v.motivo } })
          : v.tipo === "ajustar" ? fns.ajustar({ data: { alvo, modo: v.modo, qtd: v.qtd, motivo: v.motivo } })
            : fns.cortesia({ data: { alvo, por_dia: v.qtd, premium: v.premium, fim: v.fim || null, motivo: v.motivo } }))} />

      <AlertDialog open={!!confirma} onOpenChange={(o) => !o && !m.isPending && setConfirma(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirma === "encerrar" ? "Encerrar a cortesia?" : "Reiniciar o teste grátis?"}</AlertDialogTitle>
            <AlertDialogDescription>{confirma === "encerrar" ? "A pessoa deixa de ter o uso diário de cortesia agora." : "O teste recomeça hoje e vale por 14 dias."}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={m.isPending}>Voltar</AlertDialogCancel>
            <AlertDialogAction disabled={m.isPending} onClick={(e) => { e.preventDefault(); m.mutate(() => confirma === "encerrar" && d.cortesia ? fns.encerrar({ data: { alvo, id: d.cortesia.id } }) : fns.reiniciar({ data: { alvo } })); }}>
              {confirma === "encerrar" ? "Encerrar" : "Reiniciar teste"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}

interface Valores { tipo: "dar" | "ajustar" | "cortesia"; qtd: number; validade: number; motivo: string; modo: "adicionar" | "remover"; premium: boolean; fim: string }

function FormDialog({ form, saldo, pending, onClose, onSubmit }: { form: Form; saldo: number; pending: boolean; onClose: () => void; onSubmit: (v: Valores) => void }) {
  const [qtd, setQtd] = useState("10");
  const [validade, setValidade] = useState("90");
  const [motivo, setMotivo] = useState("");
  const [modo, setModo] = useState<"adicionar" | "remover">("adicionar");
  const [premium, setPremium] = useState(false);
  const [fim, setFim] = useState("");
  const n = Number(qtd), v = Number(validade);
  const erro = !Number.isInteger(n) || n < 1 ? "Quantidade inválida."
    : form === "cortesia" && n > 20 ? "Por dia: de 1 a 20."
      : form === "dar" && (!Number.isInteger(v) || v < 1 || v > 730) ? "Validade: de 1 a 730 dias."
        : form === "ajustar" && modo === "remover" && n > saldo ? `O saldo é ${saldo}.`
          : motivo.trim().length < 3 ? "Motivo obrigatório (mínimo 3 caracteres)." : null;
  const titulo = form === "dar" ? "Dar créditos" : form === "ajustar" ? "Ajustar créditos" : "Dar cortesia de uso";

  return (
    <Dialog open={!!form} onOpenChange={(o) => !o && !pending && onClose()}>
      <DialogContent className="glass rounded-[22px] sm:max-w-md">
        <DialogHeader><DialogTitle>{titulo}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          {form === "ajustar" && <Segmented label="Tipo de ajuste" options={[{ id: "adicionar", label: "Adicionar" }, { id: "remover", label: "Remover" }]} value={modo} onChange={setModo} />}
          <div className="space-y-1"><Label htmlFor="cq">{form === "cortesia" ? "Análises por dia (1 a 20)" : "Quantidade"}</Label><Input id="cq" inputMode="numeric" value={qtd} onChange={(e) => setQtd(e.target.value.replace(/\D/g, ""))} /></div>
          {form === "dar" && <div className="space-y-1"><Label htmlFor="cv">Validade (dias)</Label><Input id="cv" inputMode="numeric" value={validade} onChange={(e) => setValidade(e.target.value.replace(/\D/g, ""))} /></div>}
          {form === "cortesia" && (
            <>
              <label className="flex items-center justify-between gap-3 text-sm">Inclui Premium<Switch checked={premium} onCheckedChange={setPremium} aria-label="Inclui Premium" /></label>
              <div className="space-y-1"><Label htmlFor="cf">Termina em (opcional)</Label><Input id="cf" type="date" value={fim} onChange={(e) => setFim(e.target.value)} /></div>
              {!fim && <Tag tone="warning">Sem prazo final — lembre de encerrar</Tag>}
              <p className="text-xs text-muted-foreground">Começa hoje. Uma cortesia nova encerra a anterior.</p>
            </>
          )}
          <div className="space-y-1"><Label htmlFor="cm">Motivo</Label><Input id="cm" value={motivo} maxLength={300} onChange={(e) => setMotivo(e.target.value)} /></div>
          {erro && <p className="text-xs text-destructive-ink" role="alert">{erro}</p>}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={pending}>Cancelar</Button>
          <Button disabled={!!erro || pending} onClick={() => form && onSubmit({ tipo: form, qtd: n, validade: v, motivo: motivo.trim(), modo, premium, fim })}>{pending ? "Salvando…" : "Confirmar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
