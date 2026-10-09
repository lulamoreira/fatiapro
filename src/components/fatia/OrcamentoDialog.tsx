import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertTriangle, ImagePlus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useNegocio } from "@/hooks/use-negocio";
import { reduzirImagem } from "@/lib/imagem";
import { baixarOrcamentoPdf } from "@/lib/orcamento-pdf";
import { FORMAS_PAGAMENTO, brl, faixaDesconto, paraCentavos, totalCentavos, type Precos } from "@/lib/orcamento";
import { Chip } from "@/components/fatia/Chip";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type Opcao = "justo" | "premium" | "minimo" | "desconto" | "outro";
export interface OrcamentoDialogProps {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  jobId?: string | null;
  descricaoInicial?: string;
  precos?: Precos | null;
}

export function OrcamentoDialog({ open, onOpenChange, jobId = null, descricaoInicial = "", precos = null }: OrcamentoDialogProps) {
  const qc = useQueryClient();
  const { data: negocio } = useNegocio();
  const [cliente, setCliente] = useState("");
  const [contato, setContato] = useState("");
  const [descricao, setDescricao] = useState(descricaoInicial);
  const [qtd, setQtd] = useState(String(precos?.quantidade ?? 1));
  const [opcao, setOpcao] = useState<Opcao | null>(null);
  const [outro, setOutro] = useState("");
  const [prazo, setPrazo] = useState("");
  const [validade, setValidade] = useState("7");
  const [formas, setFormas] = useState<string[]>([]);
  const [obs, setObs] = useState("");
  const [foto, setFoto] = useState<{ blob: Blob; url: string } | null>(null);
  const [enviando, setEnviando] = useState(false);

  const q = Math.max(1, Math.floor(Number(qtd) || 1));
  const faixa = precos ? faixaDesconto(precos.descontos, q) : null;
  const opcoes = useMemo(() => {
    const o: { id: Opcao; rot: string; v: number }[] = [];
    if (faixa) o.push({ id: "desconto", rot: "Desconto por quantidade", v: faixa.preco_unitario });
    if (precos?.justo) o.push({ id: "justo", rot: "Justo", v: precos.justo });
    if (precos?.premium) o.push({ id: "premium", rot: "Premium", v: precos.premium });
    if (precos?.minimo) o.push({ id: "minimo", rot: "Mínimo", v: precos.minimo });
    return o;
  }, [precos, faixa]);
  // Default: discount tier when applicable, else Justo, else free value.
  const escolhida: Opcao = opcao && (opcao === "outro" || opcoes.some((x) => x.id === opcao)) ? opcao : (opcoes.find((x) => x.id === "desconto") ?? opcoes.find((x) => x.id === "justo") ?? opcoes[0])?.id ?? "outro";
  const unitReais = escolhida === "outro" ? Number(outro.replace(/\./g, "").replace(",", ".")) || 0 : opcoes.find((x) => x.id === escolhida)?.v ?? 0;
  const unit = paraCentavos(unitReais);
  const total = totalCentavos(q, unit);
  const abaixoCusto = precos?.custo_unitario && unit > 0 && unit < paraCentavos(precos.custo_unitario) ? paraCentavos(precos.custo_unitario) : null;

  async function escolherFoto(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/")) { toast.error("Escolha uma imagem."); return; }
    try {
      const r = await reduzirImagem(file, 1000, 0.8, false);
      setFoto({ blob: r.blob, url: r.dataUrl });
    } catch { toast.error("Não foi possível ler a foto."); }
  }

  async function confirmar() {
    if (!negocio) return;
    if (!cliente.trim() || !descricao.trim()) { toast.error("Preencha o cliente e a descrição."); return; }
    if (unit < 1) { toast.error("Informe o preço por unidade."); return; }
    setEnviando(true);
    try {
      let foto_path: string | null = null;
      if (foto) {
        foto_path = `${negocio.user_id}/foto-${crypto.randomUUID()}.jpg`;
        const { error } = await supabase.storage.from("negocio").upload(foto_path, foto.blob, { contentType: "image/jpeg" });
        if (error) throw error;
      }
      const { data, error } = await supabase.rpc("criar_orcamento", {
        p_cliente_nome: cliente.trim(), p_cliente_contato: contato.trim() || null, p_descricao: descricao.trim(),
        p_quantidade: q, p_preco_unitario_centavos: unit, p_job_id: jobId, p_prazo_entrega: prazo.trim() || null,
        p_validade_dias: Math.min(365, Math.max(1, Math.floor(Number(validade) || 7))),
        p_forma_pagamento: formas.length ? formas.join(", ") : null, p_observacoes: obs.trim() || null, p_foto_path: foto_path,
      } as never);
      const row = Array.isArray(data) ? (data[0] as { id: string } | undefined) : undefined;
      if (error || !row) throw error ?? new Error("sem_retorno");
      const { data: o, error: e2 } = await supabase.from("orcamentos").select("*").eq("id", row.id).single();
      if (e2 || !o) throw e2;
      await baixarOrcamentoPdf(negocio, o);
      toast.success("Orçamento criado.");
      await qc.invalidateQueries({ queryKey: ["orcamentos"] });
      onOpenChange(false);
    } catch (e) {
      console.error("criar_orcamento falhou:", (e as Error | null)?.message);
      toast.error("Não foi possível criar o orçamento.");
    } finally { setEnviando(false); }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader><DialogTitle>Novo orçamento</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="space-y-1.5"><Label htmlFor="o-cli">Cliente *</Label><Input id="o-cli" value={cliente} maxLength={120} onChange={(e) => setCliente(e.target.value)} /></div>
            <div className="space-y-1.5"><Label htmlFor="o-con">Contato (e-mail ou WhatsApp)</Label><Input id="o-con" value={contato} maxLength={120} onChange={(e) => setContato(e.target.value)} /></div>
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_120px]">
            <div className="space-y-1.5"><Label htmlFor="o-desc">Descrição da peça *</Label><Input id="o-desc" value={descricao} maxLength={120} onChange={(e) => setDescricao(e.target.value)} /></div>
            <div className="space-y-1.5"><Label htmlFor="o-qtd">Quantidade</Label><Input id="o-qtd" type="number" min={1} value={qtd} onChange={(e) => setQtd(e.target.value)} /></div>
          </div>
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Preço por unidade</legend>
            <div className="flex flex-wrap gap-2">
              {opcoes.map((x) => <Chip key={x.id} selected={escolhida === x.id} onClick={() => setOpcao(x.id)}>{x.rot} {brl(paraCentavos(x.v))}</Chip>)}
              <Chip selected={escolhida === "outro"} onClick={() => setOpcao("outro")}>Outro valor</Chip>
            </div>
            {escolhida === "outro" && <Input aria-label="Outro valor em reais" inputMode="decimal" placeholder="Ex.: 25,90" value={outro} onChange={(e) => setOutro(e.target.value)} className="max-w-40" />}
            {abaixoCusto && <p className="flex items-center gap-2 rounded-xl bg-warning/15 px-3 py-2 text-sm text-foreground"><AlertTriangle className="size-4" aria-hidden />Abaixo do seu custo ({brl(abaixoCusto)})</p>}
            <p className="text-sm">Total: <span className="font-bold tabular" aria-live="polite">{brl(total)}</span></p>
          </fieldset>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_120px]">
            <div className="space-y-1.5"><Label htmlFor="o-prazo">Prazo de entrega</Label><Input id="o-prazo" placeholder="Ex.: 5 dias úteis" value={prazo} maxLength={120} onChange={(e) => setPrazo(e.target.value)} /></div>
            <div className="space-y-1.5"><Label htmlFor="o-val">Validade (dias)</Label><Input id="o-val" type="number" min={1} max={365} value={validade} onChange={(e) => setValidade(e.target.value)} /></div>
          </div>
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Forma de pagamento</legend>
            <div className="flex flex-wrap gap-2">
              {FORMAS_PAGAMENTO.map((fp) => <Chip key={fp} selected={formas.includes(fp)} onClick={() => setFormas((s) => (s.includes(fp) ? s.filter((x) => x !== fp) : [...s, fp]))}>{fp}</Chip>)}
            </div>
          </fieldset>
          <div className="space-y-1.5"><Label htmlFor="o-obs">Observações</Label><Textarea id="o-obs" value={obs} maxLength={1000} onChange={(e) => setObs(e.target.value)} /></div>
          <div className="flex items-center gap-3">
            {foto && <img src={foto.url} alt="Foto da peça" className="size-16 rounded-xl object-cover" />}
            <Label className="cursor-pointer">
              <span className="inline-flex min-h-10 items-center gap-2 rounded-full border px-4 text-sm font-medium hover:bg-secondary"><ImagePlus className="size-4" aria-hidden />{foto ? "Trocar foto" : "Foto da peça (opcional)"}</span>
              <input type="file" accept="image/*" className="sr-only" onChange={(e) => { void escolherFoto(e.target.files?.[0]); e.target.value = ""; }} />
            </Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={() => void confirmar()} disabled={enviando}>{enviando ? "Gerando…" : "Gerar orçamento em PDF"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
