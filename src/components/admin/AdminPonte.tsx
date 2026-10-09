import { useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { usePonteVersoes, type PonteVersao } from "@/hooks/use-ponte-versoes";
import { compararVersao, extensaoValida, parseCodigoAssinatura, VERSAO_RE, type Plataforma } from "@/lib/ponte";
import { formatBytes } from "@/lib/storage";
import { Segmented, Tag } from "@/components/fatia/Chip";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

async function sha256DoArquivo(f: File): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", await f.arrayBuffer());
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Uploads with progress. RLS on storage.objects only lets admins insert into "ponte". */
async function enviar(path: string, f: File, onProg: (p: number) => void): Promise<void> {
  const { data: s } = await supabase.auth.getSession();
  const token = s.session?.access_token;
  if (!token) throw new Error("sem sessão");
  const base = import.meta.env['VITE_SUPABASE_URL'] as string;
  await new Promise<void>((res, rej) => {
    const x = new XMLHttpRequest();
    x.open("POST", `${base}/storage/v1/object/ponte/${path}`);
    x.setRequestHeader("Authorization", `Bearer ${token}`);
    x.setRequestHeader("apikey", import.meta.env['VITE_SUPABASE_PUBLISHABLE_KEY'] as string);
    x.setRequestHeader("Content-Type", f.type || "application/octet-stream");
    x.setRequestHeader("x-upsert", "false");
    x.upload.onprogress = (e) => e.lengthComputable && onProg(Math.round((e.loaded / e.total) * 100));
    x.onload = () => (x.status < 300 ? res() : rej(new Error(x.responseText)));
    x.onerror = () => rej(new Error("rede"));
    x.send(f);
  });
}

export function AdminPonte() {
  const qc = useQueryClient();
  const { data: versoes, isLoading } = usePonteVersoes();
  const [plataforma, setPlataforma] = useState<Plataforma>("macos");
  const [versao, setVersao] = useState("");
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [codigo, setCodigo] = useState("");
  const [notas, setNotas] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [prog, setProg] = useState<number | null>(null);
  const [confirmar, setConfirmar] = useState<PonteVersao | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    if (!VERSAO_RE.test(versao.trim())) return setErro("Use o formato X.Y.Z (ex.: 1.2.0).");
    if (!arquivo || !extensaoValida(arquivo.name, plataforma)) return setErro(`Escolha um arquivo ${plataforma === "macos" ? ".pkg" : ".exe"}.`);
    if (arquivo.size > 200 * 1024 * 1024) return setErro("O arquivo passa de 200 MB.");
    const cod = parseCodigoAssinatura(codigo);
    if (!cod) return setErro("Cole as duas linhas: \"sha256 <hex>\" e \"assinatura <base64>\".");
    setProg(0);
    try {
      if ((await sha256DoArquivo(arquivo)) !== cod.sha256) { setProg(null); return setErro("Este arquivo não confere com o código de assinatura."); }
      const v = versao.trim();
      const path = `${plataforma}/${v}/${crypto.randomUUID()}.${plataforma === "macos" ? "pkg" : "exe"}`;
      await enviar(path, arquivo, setProg);
      const { error } = await supabase.from("ponte_versoes").insert({
        plataforma, versao: v, arquivo_path: path, nome_arquivo: arquivo.name, tamanho_bytes: arquivo.size,
        sha256: cod.sha256, assinatura: cod.assinatura, notas: notas.trim() || null, publicada: false,
      });
      if (error) {
        await supabase.storage.from("ponte").remove([path]);
        throw new Error(error.code === "23505" ? "Essa versão já existe para esta plataforma." : "Não foi possível gravar a versão.");
      }
      toast.success("Versão enviada como rascunho.");
      setVersao(""); setArquivo(null); setCodigo(""); setNotas("");
      qc.invalidateQueries({ queryKey: ["ponte-versoes"] });
    } catch (err) {
      setErro(err instanceof Error && err.message.startsWith("Essa") ? err.message : "Não foi possível enviar o arquivo.");
    } finally { setProg(null); }
  }

  async function alternar(v: PonteVersao) {
    const { error } = await supabase.from("ponte_versoes").update({ publicada: !v.publicada }).eq("id", v.id);
    if (error) toast.error("Não foi possível alterar.");
    else { toast.success(v.publicada ? "Versão despublicada." : "Versão publicada."); qc.invalidateQueries({ queryKey: ["ponte-versoes"] }); }
    setConfirmar(null);
  }

  const lista = [...(versoes ?? [])].sort((a, b) => compararVersao(b.versao, a.versao) || b.criado_em.localeCompare(a.criado_em));

  return (
    <div className="space-y-6">
      <form onSubmit={submit} className="space-y-4 rounded-2xl border bg-card p-5 md:p-6">
        <h2 className="text-lg font-semibold">Enviar nova versão</h2>
        <Segmented label="Plataforma" value={plataforma} onChange={setPlataforma} options={[{ id: "macos", label: "macOS" }, { id: "windows", label: "Windows" }]} />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-1.5"><Label htmlFor="pv-versao">Versão</Label><Input id="pv-versao" placeholder="1.2.0" value={versao} onChange={(e) => setVersao(e.target.value)} /></div>
          <div className="space-y-1.5"><Label htmlFor="pv-arq">Arquivo (.pkg ou .exe)</Label><Input id="pv-arq" type="file" accept={plataforma === "macos" ? ".pkg" : ".exe"} onChange={(e) => setArquivo(e.target.files?.[0] ?? null)} /></div>
        </div>
        <div className="space-y-1.5"><Label htmlFor="pv-cod">Código de assinatura</Label><Textarea id="pv-cod" rows={3} className="font-mono text-xs" placeholder={"sha256 <hex>\nassinatura <base64>"} value={codigo} onChange={(e) => setCodigo(e.target.value)} /></div>
        <div className="space-y-1.5"><Label htmlFor="pv-notas">Notas da versão</Label><Textarea id="pv-notas" rows={3} value={notas} onChange={(e) => setNotas(e.target.value)} /></div>
        {erro && <p role="alert" className="text-sm font-medium text-destructive-ink">{erro}</p>}
        {prog !== null && <Progress value={prog} aria-label="Progresso do envio" />}
        <Button type="submit" disabled={prog !== null}>{prog !== null ? `Enviando… ${prog}%` : "Enviar versão"}</Button>
      </form>

      <section className="rounded-2xl border bg-card p-5 md:p-6">
        <h2 className="mb-4 text-lg font-semibold">Versões</h2>
        {isLoading ? <Skeleton className="h-24" /> : !lista.length ? <p className="text-sm text-muted-foreground">Nenhuma versão enviada.</p> : (
          <ul className="divide-y">
            {lista.map((v) => (
              <li key={v.id} className="flex flex-wrap items-center gap-3 py-3">
                <span className="w-20 text-sm font-medium">{v.plataforma === "macos" ? "macOS" : "Windows"}</span>
                <span className="w-20 font-semibold tabular">{v.versao}</span>
                <span className="w-20 text-sm text-muted-foreground">{formatBytes(Number(v.tamanho_bytes))}</span>
                <span className="flex-1 text-sm text-muted-foreground">{new Date(v.criado_em).toLocaleDateString("pt-BR")}</span>
                {v.publicada_por_assinatura && <Tag tone="primary">Publicada pela assinatura</Tag>}
                <Tag tone={v.publicada ? "success" : "warning"}>{v.publicada ? "Publicada" : "Rascunho"}</Tag>
                <Button size="sm" variant="secondary" onClick={() => setConfirmar(v)}>{v.publicada ? "Despublicar" : "Publicar"}</Button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <AlertDialog open={!!confirmar} onOpenChange={(o) => !o && setConfirmar(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmar?.publicada ? "Despublicar" : "Publicar"} a versão {confirmar?.versao}?</AlertDialogTitle>
            <AlertDialogDescription>{confirmar?.publicada ? "As pontes deixam de receber esta versão." : "Todas as pontes vão se atualizar para esta versão nas próximas horas."}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => confirmar && alternar(confirmar)}>{confirmar?.publicada ? "Despublicar" : "Publicar"}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
