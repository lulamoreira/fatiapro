import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Store, Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useNegocio } from "@/hooks/use-negocio";
import { reduzirImagem } from "@/lib/imagem";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";

const CAMPOS = [
  { k: "nome", rot: "Nome do negócio *", max: 120 },
  { k: "documento", rot: "CPF/CNPJ", max: 30 },
  { k: "email", rot: "E-mail", max: 160 },
  { k: "whatsapp", rot: "WhatsApp", max: 40 },
  { k: "cidade", rot: "Cidade", max: 120 },
] as const;
type Form = Record<(typeof CAMPOS)[number]["k"], string>;

/** "Meu negócio" — header data printed on quotes. */
export function MeuNegocio() {
  const qc = useQueryClient();
  const { data: n, isLoading } = useNegocio();
  const [f, setF] = useState<Form>({ nome: "", documento: "", email: "", whatsapp: "", cidade: "" });
  const [salvando, setSalvando] = useState(false);
  useEffect(() => {
    if (n) setF({ nome: n.nome, documento: n.documento ?? "", email: n.email ?? "", whatsapp: n.whatsapp ?? "", cidade: n.cidade ?? "" });
  }, [n]);

  const { data: logoUrl } = useQuery({
    queryKey: ["negocio-logo", n?.logo_path],
    enabled: !!n?.logo_path,
    queryFn: async () => (await supabase.storage.from("negocio").createSignedUrl(n!.logo_path!, 3600)).data?.signedUrl ?? null,
  });

  async function salvar(logo_path?: string) {
    if (!f.nome.trim()) { toast.error("Preencha o nome do negócio."); return; }
    setSalvando(true);
    const { data: u } = await supabase.auth.getUser();
    const uid = u.user?.id;
    if (!uid) { setSalvando(false); return; }
    const linha = {
      nome: f.nome.trim(), documento: f.documento.trim() || null, email: f.email.trim() || null,
      whatsapp: f.whatsapp.trim() || null, cidade: f.cidade.trim() || null,
      ...(logo_path !== undefined ? { logo_path } : {}),
    };
    const { error } = n
      ? await supabase.from("negocio").update({ ...linha, atualizado_em: new Date().toISOString() }).eq("user_id", uid)
      : await supabase.from("negocio").insert({ user_id: uid, ...linha });
    setSalvando(false);
    if (error) { toast.error("Não foi possível salvar."); return; }
    toast.success("Salvo");
    await qc.invalidateQueries({ queryKey: ["negocio"] });
  }

  async function enviarLogo(file: File | undefined) {
    if (!file) return;
    if (!/^image\/(png|jpeg)$/.test(file.type)) { toast.error("Use uma imagem PNG ou JPG."); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error("O logo pode ter até 5 MB."); return; }
    if (!f.nome.trim()) { toast.error("Preencha o nome do negócio antes do logo."); return; }
    try {
      const img = await reduzirImagem(file, 600, 0.85, true);
      const { data: u } = await supabase.auth.getUser();
      const path = `${u.user!.id}/logo-${Date.now()}.${img.tipo === "image/png" ? "png" : "jpg"}`;
      const { error } = await supabase.storage.from("negocio").upload(path, img.blob, { contentType: img.tipo });
      if (error) throw error;
      await salvar(path);
    } catch { toast.error("Não foi possível enviar o logo."); }
  }

  return (
    <section aria-labelledby="negocio-t" className="space-y-4 rounded-3xl border bg-card p-6">
      <div>
        <h2 id="negocio-t" className="flex items-center gap-2 text-lg font-semibold"><Store className="size-5 text-primary-ink" aria-hidden />Meu negócio</h2>
        <p className="text-sm text-muted-foreground">Aparece no cabeçalho dos seus orçamentos.</p>
      </div>
      {isLoading ? <Skeleton className="h-40 rounded-2xl" /> : (
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); void salvar(); }}>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {CAMPOS.map((c) => (
              <div key={c.k} className="space-y-1.5">
                <Label htmlFor={`neg-${c.k}`}>{c.rot}</Label>
                <Input id={`neg-${c.k}`} value={f[c.k]} maxLength={c.max} required={c.k === "nome"} onChange={(e) => setF((x) => ({ ...x, [c.k]: e.target.value }))} />
              </div>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex size-20 items-center justify-center overflow-hidden rounded-2xl border bg-secondary">
              {logoUrl ? <img src={logoUrl} alt="Logo do negócio" className="max-h-full max-w-full object-contain" /> : <span className="text-xs text-muted-foreground">Sem logo</span>}
            </div>
            <Label className="cursor-pointer">
              <span className="inline-flex min-h-10 items-center gap-2 rounded-full border px-4 text-sm font-medium hover:bg-secondary"><Upload className="size-4" aria-hidden />Enviar logo (PNG/JPG até 5 MB)</span>
              <input type="file" accept="image/png,image/jpeg" className="sr-only" onChange={(e) => { void enviarLogo(e.target.files?.[0]); e.target.value = ""; }} />
            </Label>
          </div>
          <div className="flex justify-end"><Button type="submit" variant="secondary" disabled={salvando}>Salvar</Button></div>
        </form>
      )}
    </section>
  );
}
