/** Gera e guarda a miniatura de uma peça da Biblioteca a partir da imagem embutida no 3MF. */
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { tamanhoArquivo } from "@/lib/storage";
import { leitorDeUrl, pngDo3mf } from "@/lib/miniatura-3mf";

const eh3mf = (p: string | null): p is string => !!p && /\.3mf$/i.test(p);

/** Reduz a imagem para no máximo 320 px no maior lado, mantendo a transparência. */
async function reduzir(png: Uint8Array): Promise<{ blob: Blob; ext: "webp" | "png" }> {
  const bmp = await createImageBitmap(new Blob([png as unknown as BlobPart]));
  const escala = Math.min(1, 320 / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bmp.width * escala));
  canvas.height = Math.max(1, Math.round(bmp.height * escala));
  canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  bmp.close();
  let blob = await new Promise<Blob | null>((ok) => canvas.toBlob(ok, "image/webp", 0.8));
  if (blob && blob.type === "image/webp") return { blob, ext: "webp" };
  blob = await new Promise<Blob | null>((ok) => canvas.toBlob(ok, "image/png"));
  if (!blob) throw new Error("falha ao codificar a miniatura");
  return { blob, ext: "png" };
}

async function pngDaPeca(path: string): Promise<Uint8Array | null> {
  const tamanho = await tamanhoArquivo(path);
  if (tamanho == null || tamanho <= 0) return null;
  const { data, error } = await supabase.storage.from("pecas").createSignedUrl(path, 300);
  if (error || !data) throw error ?? new Error("sem url assinada");
  return pngDo3mf(leitorDeUrl(data.signedUrl), tamanho);
}

/**
 * Tenta gerar a miniatura da peça. Erros de rede/permissão NÃO gravam
 * miniatura_tentada_em, para tentar de novo na próxima visita; só avisam no console.
 */
export async function gerarMiniatura(peca: Tables<"pecas">): Promise<void> {
  try {
    const candidatos = [peca.arquivo_original_path, peca.arquivo_otimizado_path].filter(eh3mf);
    if (!candidatos.length) {
      await marcarTentativa(peca.id, null);
      return;
    }
    let png: Uint8Array | null = null;
    for (const path of candidatos) {
      png = await pngDaPeca(path);
      if (png) break;
    }
    if (!png) {
      await marcarTentativa(peca.id, null);
      return;
    }
    const { blob, ext } = await reduzir(png);
    const miniaturaPath = `${peca.user_id}/miniaturas/${peca.id}.${ext}`;
    const { error } = await supabase.storage.from("pecas").upload(miniaturaPath, blob, { upsert: true, contentType: blob.type });
    if (error) throw error;
    await marcarTentativa(peca.id, miniaturaPath);
  } catch (e) {
    console.warn("Não foi possível gerar a miniatura da peça", peca.id, e);
  }
}

async function marcarTentativa(id: string, miniaturaPath: string | null): Promise<void> {
  const { error } = await supabase
    .from("pecas")
    .update({ miniatura_path: miniaturaPath, miniatura_tentada_em: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}
