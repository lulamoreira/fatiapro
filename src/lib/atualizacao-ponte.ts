import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { compararVersao, maisAlta } from "@/lib/ponte";

export interface VersaoPonte { versao: string; plataforma: string; notas: string | null }
export interface DeviceAtualizacao {
  id: string;
  sistema: string;
  versao_ponte: string | null;
  ultimo_contato: string | null;
}

export const ponteNovaQuery = queryOptions({
  queryKey: ["ponte-nova"],
  staleTime: 5 * 60_000,
  refetchInterval: 5 * 60_000,
  queryFn: async (): Promise<VersaoPonte[]> => {
    const versoes: VersaoPonte[] = [];
    for (let inicio = 0; ; inicio += 1000) {
      const { data, error, count } = await supabase.from("ponte_versoes")
        .select("versao, plataforma, notas", { count: "exact" }).eq("publicada", true)
        .order("criado_em", { ascending: false }).order("id", { ascending: false })
        .range(inicio, inicio + 999);
      if (error) throw error;
      versoes.push(...(data ?? []));
      if (!data?.length || (count != null ? versoes.length >= count : data.length < 1000)) return versoes;
    }
  },
});

export function precisaAtualizar(device: Pick<DeviceAtualizacao, "sistema" | "versao_ponte">, versoes: readonly VersaoPonte[]): VersaoPonte | null {
  if (!device.versao_ponte?.trim()) return null;
  const nova = maisAlta(versoes.filter((v) => v.plataforma === device.sistema));
  return nova && compararVersao(nova.versao, device.versao_ponte) > 0 ? nova : null;
}
export const temBotao = (versaoPonte: string | null | undefined): boolean => compararVersao(versaoPonte, "0.3.51") >= 0;
export const ESTADOS_ANALISE_ABERTA = ["analisando", "aplicando", "aguardando_aprovacao"];
export const analiseAbertaQuery = (deviceId?: string) => queryOptions({
  queryKey: ["ponte-analise-aberta", deviceId],
  enabled: !!deviceId,
  refetchInterval: 15_000,
  queryFn: async () => {
    if (!deviceId) return 0;
    const { count, error } = await supabase.from("jobs").select("id", { count: "exact", head: true })
      .eq("device_id", deviceId).in("estado", ESTADOS_ANALISE_ABERTA)
      .order("criado_em", { ascending: false }).order("id", { ascending: false });
    if (error) throw error;
    return count ?? 0;
  },
});

export const chaveDepois = (deviceId: string, versao: string): string => `fatiapro.ponte_depois.${deviceId}.${versao}`;
export function avisoPodeVoltar(adiadoEm: string | null, agora: number): boolean {
  if (!adiadoEm) return true;
  const data = Number(adiadoEm);
  return !Number.isFinite(data) || agora - data >= 24 * 60 * 60_000;
}
export function lerDepois(deviceId: string, versao: string): string | null {
  try { return globalThis.localStorage?.getItem(chaveDepois(deviceId, versao)) ?? null; }
  catch { return null; }
}
export function guardarDepois(deviceId: string, versao: string, agora: number): void {
  try { globalThis.localStorage?.setItem(chaveDepois(deviceId, versao), String(agora)); }
  catch { /* A indisponibilidade do armazenamento não impede fechar o aviso. */ }
}