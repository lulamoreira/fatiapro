import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { maisAlta } from "./ponte";

/** Signed download URL (15 min) for the highest published installer of a platform. */
export const baixarPonte = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ plataforma: z.enum(["macos", "windows"]) }).parse(d))
  .handler(async ({ data, context }) => {
    // RLS as the user: only published rows are visible to non-admins.
    const { data: rows, error } = await context.supabase.from("ponte_versoes")
      .select("versao,arquivo_path,nome_arquivo").eq("plataforma", data.plataforma).eq("publicada", true)
      .order("criado_em", { ascending: false }).order("id", { ascending: false }).range(0, 999);
    if (error) throw new Error("Falha ao ler versões");
    const v = maisAlta(rows ?? []);
    if (!v) throw new Error("Nenhuma versão publicada");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: s, error: e2 } = await supabaseAdmin.storage.from("ponte").createSignedUrl(v.arquivo_path, 900, { download: v.nome_arquivo });
    if (e2 || !s) throw new Error("Falha ao gerar o link");
    return { url: s.signedUrl };
  });
