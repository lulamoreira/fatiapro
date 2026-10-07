/** Pure helpers: storage keys use only safe ASCII; the real (possibly non-ASCII) file name lives in the database. */

export const EXTENSOES = ["3mf", "stl", "step", "stp"] as const;

/** Lowercase allowed extension of a file name, or null. */
export function extensaoPermitida(nome: string): string | null {
  const m = /\.([^.]+)$/.exec(nome);
  const ext = m?.[1]?.toLowerCase();
  return ext && (EXTENSOES as readonly string[]).includes(ext) ? ext : null;
}

/** Validates a real file name sent by the bridge (accents/CJK allowed). Returns the trimmed name or null. */
export function validarNomeArquivo(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const nome = raw.trim();
  if (!nome || nome.length > 200 || /[\\/\0]/.test(nome) || nome === "." || nome === "..") return null;
  return extensaoPermitida(nome) ? nome : null;
}

/** "<user_id>/<uuid>/original.<ext>" for browser uploads. */
export const caminhoOriginal = (userId: string, uuid: string, ext: string) => `${userId}/${uuid}/original.${ext}`;

/** "<user_id>/<job_id>/<tipo>/<uuid>.<ext>" for bridge uploads. */
export const caminhoBridge = (userId: string, jobId: string, tipo: string, uuid: string, ext: string) =>
  `${userId}/${jobId}/${tipo}/${uuid}.${ext}`;

const ultimo = (p: string) => p.split(/[\\/]/).pop() || null;

/** Real names for a job's files, read defensively from resultado. */
export function nomesDoJob(job: { nome_peca: string | null; resultado: unknown }) {
  const r = (job.resultado && typeof job.resultado === "object" ? job.resultado : {}) as Record<string, unknown>;
  const s = (k: string) => (typeof r[k] === "string" && (r[k] as string).trim() ? (r[k] as string).trim() : null);
  const original = job.nome_peca ?? s("original_nuvem_nome");
  const local = s("arquivo_local");
  const otimizado = s("arquivo_nuvem_nome") ?? (local ? ultimo(local) : null);
  return { original, otimizado };
}

/** Name used for downloads, with fallbacks for old records. */
export const nomeDownloadOriginal = (nome: string | null | undefined, nomePecaJob: string | null | undefined) =>
  nome || nomePecaJob || "original.3mf";
export const nomeDownloadOtimizado = (nome: string | null | undefined) => nome || "otimizado.3mf";
