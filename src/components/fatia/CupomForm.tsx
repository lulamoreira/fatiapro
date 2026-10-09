import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Ticket } from "lucide-react";
import { resgatarCupom } from "@/lib/cupons.functions";
import { dataBR } from "@/lib/cupons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function CupomForm() {
  const qc = useQueryClient();
  const fn = useServerFn(resgatarCupom);
  const [codigo, setCodigo] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null);
  const m = useMutation({
    mutationFn: () => fn({ data: { codigo } }),
    onSuccess: (r) => {
      if (r.ok) {
        setMsg({ ok: true, texto: `Cupom aplicado: +${r.creditos} créditos (valem até ${dataBR(r.expira_em)})` });
        setCodigo("");
        for (const k of ["meu-plano", "creditos-lotes", "creditos-extrato"]) qc.invalidateQueries({ queryKey: [k] });
      } else setMsg({ ok: false, texto: r.mensagem });
    },
    onError: () => setMsg({ ok: false, texto: "Não foi possível aplicar o cupom agora." }),
  });
  return (
    <section aria-labelledby="cupom-t" className="space-y-2 rounded-3xl border bg-card p-6">
      <Label id="cupom-t" htmlFor="cupom" className="flex items-center gap-2 text-sm font-semibold"><Ticket className="size-4" aria-hidden />Tenho um cupom</Label>
      <form className="flex flex-col gap-2 sm:flex-row" onSubmit={(e) => { e.preventDefault(); if (codigo.trim()) m.mutate(); }}>
        <Input id="cupom" value={codigo} maxLength={30} autoComplete="off" placeholder="CÓDIGO" className="uppercase" onChange={(e) => { setCodigo(e.target.value); setMsg(null); }} />
        <Button type="submit" variant="outline" disabled={!codigo.trim() || m.isPending}>{m.isPending ? "Aplicando…" : "Aplicar"}</Button>
      </form>
      {msg && <p role="status" className={msg.ok ? "text-sm font-semibold text-success-ink" : "text-sm text-destructive-ink"}>{msg.texto}</p>}
    </section>
  );
}
