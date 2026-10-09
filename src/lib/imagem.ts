/** Browser-only image downscaling (keeps jsPDF and uploads small). */
export interface ImagemReduzida { blob: Blob; dataUrl: string; tipo: "image/png" | "image/jpeg"; largura: number; altura: number }

async function carregar(src: Blob): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === "function") return createImageBitmap(src);
  const url = URL.createObjectURL(src);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return img;
  } finally { URL.revokeObjectURL(url); }
}

/** Scales so the longest side is ≤ max; PNG when `manterTransparencia` and the image has alpha, else JPEG. */
export async function reduzirImagem(src: Blob, max: number, qualidade: number, manterTransparencia = false): Promise<ImagemReduzida> {
  const img = await carregar(src);
  const w0 = img.width, h0 = img.height;
  const k = Math.min(1, max / Math.max(w0, h0));
  const w = Math.max(1, Math.round(w0 * k)), h = Math.max(1, Math.round(h0 * k));
  const cv = document.createElement("canvas");
  cv.width = w; cv.height = h;
  const ctx = cv.getContext("2d");
  if (!ctx) throw new Error("canvas_indisponivel");
  ctx.drawImage(img, 0, 0, w, h);
  let alpha = false;
  if (manterTransparencia) {
    const d = ctx.getImageData(0, 0, w, h).data;
    for (let i = 3; i < d.length; i += 4) if (d[i]! < 255) { alpha = true; break; }
  }
  const tipo = alpha ? "image/png" : "image/jpeg";
  if (!alpha) {
    // JPEG has no alpha: paint white under the image.
    ctx.globalCompositeOperation = "destination-over";
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, w, h);
  }
  const dataUrl = cv.toDataURL(tipo, qualidade);
  const blob = await (await fetch(dataUrl)).blob();
  return { blob, dataUrl, tipo, largura: w, altura: h };
}
