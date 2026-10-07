import { useQuery } from "@tanstack/react-query";
import { devicesQuery } from "@/lib/queries";
import { fatiadorLabel, parseRelatorio } from "@/lib/fatia";

/** Slicer display name using the names reported by the user's computers. */
export function useFatiadorLabel(): (id: string | null | undefined) => string {
  const { data: devices = [] } = useQuery(devicesQuery);
  const fatiadores = devices.flatMap((d) => parseRelatorio(d.relatorio).fatiadores);
  return (id) => fatiadorLabel(id, { fatiadores });
}
