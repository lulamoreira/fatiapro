/** Lê só o pedaço do 3MF que tem a imagem (o arquivo é um zip), sem baixar a malha inteira. */
export type LerFaixa = (inicio: number, fim: number) => Promise<Uint8Array>;

export interface Entrada { nome: string; metodo: number; tamanhoComprimido: number; tamanhoReal: number; offset: number }

const u16 = (b: Uint8Array, i: number) => b[i]! | (b[i + 1]! << 8);
const u32 = (b: Uint8Array, i: number) => (u16(b, i) + u16(b, i + 2) * 65536);
const u64 = (b: Uint8Array, i: number) => u32(b, i) + u32(b, i + 4) * 4294967296;

export function lerDiretorio(dir: Uint8Array): Entrada[] {
  const fora: Entrada[] = [];
  const texto = new TextDecoder();
  for (let i = 0; i + 46 <= dir.length && u32(dir, i) === 0x02014b50; ) {
    const n = u16(dir, i + 28), extra = u16(dir, i + 30), comentario = u16(dir, i + 32);
    let tamanhoComprimido = u32(dir, i + 20), tamanhoReal = u32(dir, i + 24), offset = u32(dir, i + 42);
    // Zip64: os campos cheios de 0xFFFFFFFF vêm no campo extra 0x0001, nessa ordem
    for (let x = i + 46 + n, fim = x + extra; x + 4 <= fim; x += 4 + u16(dir, x + 2)) {
      if (u16(dir, x) !== 1) continue;
      let p = x + 4;
      if (tamanhoReal === 0xffffffff) { tamanhoReal = u64(dir, p); p += 8; }
      if (tamanhoComprimido === 0xffffffff) { tamanhoComprimido = u64(dir, p); p += 8; }
      if (offset === 0xffffffff) { offset = u64(dir, p); p += 8; }
    }
    fora.push({ nome: texto.decode(dir.subarray(i + 46, i + 46 + n)), metodo: u16(dir, i + 10), tamanhoComprimido, tamanhoReal, offset });
    i += 46 + n + extra + comentario;
  }
  return fora;
}

/** Imagem da peça: a plate da maior peça. top_N.png tem a escala da mesa (plate_N.png é ampliada para caber). */
export function escolherImagem(entradas: Entrada[]): Entrada | null {
  const por = (n: string) => entradas.find((e) => e.nome === n) ?? null;
  const tops = entradas.filter((e) => /^Metadata\/top_\d+\.png$/.test(e.nome)).sort((a, b) => b.tamanhoReal - a.tamanhoReal);
  for (const t of tops) { const p = por(t.nome.replace("top_", "plate_")); if (p) return p; }
  const plates = entradas.filter((e) => /^Metadata\/plate_\d+\.png$/.test(e.nome));
  return plates[0] ?? por("Auxiliaries/.thumbnails/thumbnail_middle.png") ?? por("Auxiliaries/.thumbnails/thumbnail_3mf.png");
}

async function descomprimir(dados: Uint8Array): Promise<Uint8Array> {
  const s = new Blob([dados as unknown as BlobPart]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(s).arrayBuffer());
}

/** PNG da peça dentro do 3MF, ou null se ele não tiver imagem. `tamanho` = bytes do arquivo. */
export async function pngDo3mf(ler: LerFaixa, tamanho: number): Promise<Uint8Array | null> {
  const cauda = Math.min(tamanho, 66_000);
  const fim = await ler(tamanho - cauda, tamanho - 1);
  let eocd = -1;
  for (let i = fim.length - 22; i >= 0; i--) if (u32(fim, i) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) return null;
  let inicioDir = u32(fim, eocd + 16), tamanhoDir = u32(fim, eocd + 12);
  if (inicioDir === 0xffffffff || tamanhoDir === 0xffffffff) { // Zip64: o localizador fica logo antes
    const loc = eocd - 20;
    if (loc < 0 || u32(fim, loc) !== 0x07064b50) return null;
    const pos = u64(fim, loc + 8) - (tamanho - cauda);
    if (pos < 0) return null;
    tamanhoDir = u64(fim, pos + 40); inicioDir = u64(fim, pos + 48);
  }
  const entrada = escolherImagem(lerDiretorio(await ler(inicioDir, inicioDir + tamanhoDir - 1)));
  if (!entrada) return null;
  const cab = await ler(entrada.offset, entrada.offset + 29);
  const dados = entrada.offset + 30 + u16(cab, 26) + u16(cab, 28);
  const bruto = await ler(dados, dados + entrada.tamanhoComprimido - 1);
  return entrada.metodo === 0 ? bruto : await descomprimir(bruto);
}

/**
 * LerFaixa sobre uma URL (ex.: URL assinada do storage) usando o cabeçalho Range.
 * Se o servidor ignorar o Range e responder 200, guarda o arquivo inteiro em memória
 * uma única vez e passa a atender as faixas com slice, sem baixar de novo.
 */
export function leitorDeUrl(url: string): LerFaixa {
  let inteiro: Uint8Array | null = null;
  return async (inicio, fim) => {
    if (inteiro) return inteiro.slice(inicio, fim + 1);
    const res = await fetch(url, { headers: { Range: `bytes=${inicio}-${fim}` } });
    if (!res.ok && res.status !== 206) throw new Error(`falha ao ler faixa: HTTP ${res.status}`);
    const bytes = new Uint8Array(await res.arrayBuffer());
    if (res.status === 206) return bytes;
    // 200: o servidor ignorou o Range e mandou o arquivo inteiro
    inteiro = bytes;
    return bytes.slice(inicio, fim + 1);
  };
}
