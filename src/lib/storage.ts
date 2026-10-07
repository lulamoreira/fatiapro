/** Browser helpers for the private "pecas" bucket (RLS: own folder only). */
import { supabase } from "@/integrations/supabase/client";

/** Size in bytes of an object, or null when it isn't in the cloud. */
export async function tamanhoArquivo(path: string | null | undefined): Promise<number | null> {
  if (!path) return null;
  const i = path.lastIndexOf("/");
  const dir = path.slice(0, i);
  const name = path.slice(i + 1);
  const { data, error } = await supabase.storage.from("pecas").list(dir, { search: name, limit: 100 });
  if (error || !data) return null;
  const obj = data.find((o) => o.name === name);
  const size = (obj?.metadata as { size?: unknown } | null | undefined)?.size;
  return typeof size === "number" ? size : null;
}

/** Download with the real file name (the storage key itself is ASCII-only). */
export async function baixar(path: string, nomeReal: string): Promise<void> {
  const { data, error } = await supabase.storage.from("pecas").createSignedUrl(path, 300, { download: nomeReal });
  if (error || !data) throw error ?? new Error("sem url");
  window.location.assign(data.signedUrl);
}

export function formatBytes(n: number | null): string {
  if (n == null) return "—";
  if (n < 1024 * 1024) return `${(n / 1024).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} KB`;
  return `${(n / 1048576).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} MB`;
}

export const nomeDoPath = (p: string) => p.split("/").pop() ?? p;
