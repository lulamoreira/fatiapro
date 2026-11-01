import { inflateSync } from "fflate";
import { lerDiretorio, type LerFaixa } from "@/lib/miniatura-3mf";

export interface Cor3mf { slot: number; cor: string; perfil: string }

/** Material defaults from slicer profile labels; Silk must win over plain PLA. */
export function tipoDoPerfil(perfil: string): string {
  if (/silk/i.test(perfil)) return "PLA Silk";
  if (/petg/i.test(perfil)) return "PETG";
  if (/tpu/i.test(perfil)) return "TPU";
  if (/abs|asa/i.test(perfil)) return "ABS/ASA";
  return "PLA";
}

/** Reads only the ZIP directory and project settings. Invalid files fail silently. */
export async function coresDo3mf(ler: LerFaixa, tamanho: number): Promise<Cor3mf[] | null> {
  try {
    if (!Number.isSafeInteger(tamanho) || tamanho < 22) return null;
    const u16 = (b: Uint8Array, i: number) => new DataView(b.buffer, b.byteOffset, b.byteLength).getUint16(i, true);
    const u32 = (b: Uint8Array, i: number) => new DataView(b.buffer, b.byteOffset, b.byteLength).getUint32(i, true);
    const u64 = (b: Uint8Array, i: number) => u32(b, i) + u32(b, i + 4) * 4294967296;
    const cauda = Math.min(tamanho, 66_000);
    const fim = await ler(tamanho - cauda, tamanho - 1);
    let eocd = -1;
    for (let i = fim.length - 22; i >= 0; i--) {
      if (u32(fim, i) === 0x06054b50 && i + 22 + u16(fim, i + 20) === fim.length) { eocd = i; break; }
    }
    if (eocd < 0) return null;
    let inicio = u32(fim, eocd + 16), bytes = u32(fim, eocd + 12);
    if (inicio === 0xffffffff || bytes === 0xffffffff) {
      const loc = eocd - 20;
      if (loc < 0 || u32(fim, loc) !== 0x07064b50) return null;
      const pos = u64(fim, loc + 8) - (tamanho - cauda);
      if (pos < 0 || u32(fim, pos) !== 0x06064b50) return null;
      bytes = u64(fim, pos + 40); inicio = u64(fim, pos + 48);
    }
    if (!Number.isSafeInteger(inicio) || bytes <= 0 || bytes > 8_000_000 || inicio + bytes > tamanho) return null;
    const entrada = lerDiretorio(await ler(inicio, inicio + bytes - 1)).find((e) => e.nome === "Metadata/project_settings.config");
    if (!entrada || entrada.tamanhoReal > 8_000_000 || entrada.tamanhoComprimido <= 0 || entrada.tamanhoComprimido > 8_000_000) return null;
    const cab = await ler(entrada.offset, entrada.offset + 29);
    if (u32(cab, 0) !== 0x04034b50 || (u16(cab, 6) & 1)) return null;
    const offset = entrada.offset + 30 + u16(cab, 26) + u16(cab, 28);
    if (offset + entrada.tamanhoComprimido > tamanho) return null;
    const bruto = await ler(offset, offset + entrada.tamanhoComprimido - 1);
    const dados = entrada.metodo === 0 ? bruto : entrada.metodo === 8 ? inflateSync(bruto, { out: new Uint8Array(entrada.tamanhoReal) }) : null;
    if (!dados || dados.length !== entrada.tamanhoReal) return null;
    const config: unknown = JSON.parse(new TextDecoder().decode(dados));
    if (!config || typeof config !== "object") return null;
    const c = config as { filament_colour?: unknown; filament_settings_id?: unknown };
    if (!Array.isArray(c.filament_colour) || !c.filament_colour.every((v) => typeof v === "string")) return null;
    const perfis = Array.isArray(c.filament_settings_id) ? c.filament_settings_id : [];
    return c.filament_colour.map((cor: string, i: number) => ({ slot: i + 1, cor, perfil: typeof perfis[i] === "string" ? perfis[i] : "" }));
  } catch {
    return null;
  }
}