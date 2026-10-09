/** Builds the quote PDF in the browser from saved rows. Never stores the PDF. */
import { supabase } from "@/integrations/supabase/client";
import { reduzirImagem, type ImagemReduzida } from "./imagem";
import { conteudoPdf, nomeArquivoOrc, type NegocioDados, type OrcamentoDados } from "./orcamento";

async function imagemDoBucket(path: string | null, max: number): Promise<ImagemReduzida | null> {
  if (!path) return null;
  try {
    const { data, error } = await supabase.storage.from("negocio").download(path);
    if (error || !data) return null;
    // Re-reduce before embedding: large images break jsPDF ("Invalid string length").
    return await reduzirImagem(data, max, 0.8, true);
  } catch { return null; }
}

export async function baixarOrcamentoPdf(n: NegocioDados & { logo_path: string | null }, o: OrcamentoDados & { foto_path: string | null }): Promise<void> {
  const { jsPDF } = await import("jspdf");
  const [logo, foto] = await Promise.all([imagemDoBucket(n.logo_path, 400), imagemDoBucket(o.foto_path, 1000)]);
  const t = conteudoPdf(n, o);
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait", compress: true });
  const M = 18, W = 210, R = W - M;
  let y = M;

  // Header
  let xTxt = M;
  if (logo) {
    let h = 22, w = (logo.largura / logo.altura) * h;
    if (w > 45) { w = 45; h = (logo.altura / logo.largura) * w; }
    doc.addImage(logo.dataUrl, logo.tipo === "image/png" ? "PNG" : "JPEG", M, y, w, h);
    xTxt = M + w + 5;
  }
  doc.setFont("helvetica", "bold").setFontSize(13).text(t.negocio[0] ?? "", xTxt, y + 5, { maxWidth: 85 });
  doc.setFont("helvetica", "normal").setFontSize(9).setTextColor(90);
  t.negocio.slice(1).forEach((l, i) => doc.text(l, xTxt, y + 10 + i * 4.3, { maxWidth: 85 }));
  doc.setTextColor(20).setFont("helvetica", "bold").setFontSize(14).text(t.titulo, R, y + 5, { align: "right" });
  doc.setFont("helvetica", "normal").setFontSize(9).setTextColor(90).text(t.emissao, R, y + 11, { align: "right" }).text(t.valido, R, y + 15.5, { align: "right" });
  y += 32;
  doc.setDrawColor(220).line(M, y, R, y);
  y += 8;

  // Customer
  doc.setTextColor(90).setFontSize(9).text("Para:", M, y);
  doc.setTextColor(20).setFont("helvetica", "bold").setFontSize(11).text(t.para[0] ?? "", M, y + 5);
  doc.setFont("helvetica", "normal").setFontSize(9);
  if (t.para[1]) doc.text(t.para[1], M, y + 9.5);
  y += 16;

  // Photo
  if (foto) {
    const maxH = 70, maxW = R - M;
    let h = maxH, w = (foto.largura / foto.altura) * h;
    if (w > maxW) { w = maxW; h = (foto.altura / foto.largura) * w; }
    doc.addImage(foto.dataUrl, foto.tipo === "image/png" ? "PNG" : "JPEG", M, y, w, h);
    y += h + 8;
  }

  // Table
  const cols = [M, 120, 140, R];
  doc.setFillColor(243, 244, 246).rect(M, y, R - M, 8, "F");
  doc.setFont("helvetica", "bold").setFontSize(9).setTextColor(60);
  doc.text(t.cabecalho[0]!, cols[0]! + 2, y + 5.5);
  doc.text(t.cabecalho[1]!, cols[1]! + 8, y + 5.5, { align: "center" });
  doc.text(t.cabecalho[2]!, 168, y + 5.5, { align: "right" });
  doc.text(t.cabecalho[3]!, R - 2, y + 5.5, { align: "right" });
  y += 8;
  doc.setFont("helvetica", "normal").setFontSize(10).setTextColor(20);
  const desc = doc.splitTextToSize(t.linha[0]!, 95) as string[];
  doc.text(desc, cols[0]! + 2, y + 6);
  doc.text(t.linha[1]!, cols[1]! + 8, y + 6, { align: "center" });
  doc.text(t.linha[2]!, 168, y + 6, { align: "right" });
  doc.text(t.linha[3]!, R - 2, y + 6, { align: "right" });
  y += Math.max(10, desc.length * 4.6 + 4);
  doc.setDrawColor(220).line(M, y, R, y);
  y += 3;
  doc.setFillColor(255, 237, 213).rect(110, y, R - 110, 11, "F");
  doc.setFont("helvetica", "bold").setFontSize(12).text(t.total, R - 3, y + 7.5, { align: "right" });
  y += 20;

  // Conditions
  doc.setFontSize(10).text("Condições", M, y);
  y += 5.5;
  doc.setFont("helvetica", "normal").setFontSize(9.5).setTextColor(50);
  for (const c of t.condicoes) {
    const ls = doc.splitTextToSize(c, R - M) as string[];
    if (y + ls.length * 4.5 > 280) { doc.addPage(); y = M; }
    doc.text(ls, M, y);
    y += ls.length * 4.5 + 1.5;
  }

  const pags = doc.getNumberOfPages();
  for (let p = 1; p <= pags; p++) {
    doc.setPage(p).setFontSize(8).setTextColor(150).text(t.rodape, W / 2, 289, { align: "center" });
  }
  doc.save(nomeArquivoOrc(o.numero, o.cliente_nome));
}
