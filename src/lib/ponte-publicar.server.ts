import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { PonteDeps, Resultado } from "./ponte-publicar";

const BUCKET = "ponte";

export const depsReais: PonteDeps = {
  async versoesExistentes(plataforma) {
    const { data, error } = await supabaseAdmin.from("ponte_versoes").select("versao")
      .eq("plataforma", plataforma).order("criado_em", { ascending: false }).order("id", { ascending: false }).range(0, 999);
    if (error) throw error;
    return (data ?? []).map((r) => r.versao);
  },
  async urlUpload(caminho) {
    const { data, error } = await supabaseAdmin.storage.from(BUCKET).createSignedUploadUrl(caminho, { upsert: true });
    if (error || !data) throw error ?? new Error("upload_url");
    return data.signedUrl;
  },
  async baixar(caminho) {
    const { data, error } = await supabaseAdmin.storage.from(BUCKET).download(caminho);
    if (error || !data) return null;
    return new Uint8Array(await data.arrayBuffer());
  },
  async apagar(caminho) {
    await supabaseAdmin.storage.from(BUCKET).remove([caminho]);
  },
  async inserir(row) {
    const { error } = await supabaseAdmin.from("ponte_versoes").insert(row as never);
    if (error) throw error;
  },
  async auditar(detalhe) {
    const { data: adm } = await supabaseAdmin.from("app_admins").select("user_id")
      .order("criado_em", { ascending: true }).limit(1).maybeSingle();
    if (!adm) throw new Error("sem_admin");
    const { error } = await supabaseAdmin.from("admin_audit").insert({
      admin_id: adm.user_id, alvo_user_id: adm.user_id, acao: "ponte_publicada_por_assinatura", detalhe: detalhe as never,
    });
    if (error) throw error;
  },
};

export async function responder(request: Request, fn: (raw: unknown) => Promise<Resultado>): Promise<Response> {
  const h = { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" };
  try {
    let raw: unknown;
    try { raw = await request.json(); } catch { return new Response(JSON.stringify({ erro: "dados_invalidos", mensagem: "Dados inválidos." }), { status: 400, headers: h }); }
    const r = await fn(raw);
    return new Response(JSON.stringify(r.body), { status: r.status, headers: h });
  } catch (e) {
    console.error("[ponte-publicar]", e instanceof Error ? e.message : "erro");
    return new Response(JSON.stringify({ erro: "erro_interno", mensagem: "Erro interno." }), { status: 500, headers: h });
  }
}
