import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { agruparImpressoras, bicoPadrao, nomeFatiador, type FatiadorRelatorio } from "@/lib/fatia";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export interface MinhasImpressorasProps {
  deviceId: string;
  secId: string;
  fatiadores: FatiadorRelatorio[];
  escolhidas: Record<string, string[]>;
}

/** Per-slicer picker of the printers and nozzles the user owns; autosaves to devices.impressoras_escolhidas. */
export function MinhasImpressoras({ deviceId, secId, fatiadores, escolhidas }: MinhasImpressorasProps) {
  const qc = useQueryClient();
  const [aba, setAba] = useState(fatiadores[0]?.id ?? "");
  const [busca, setBusca] = useState("");
  const [salvo, setSalvo] = useState(false);
  const [local, setLocal] = useState<Record<string, string[]> | null>(null);
  const atual = local ?? escolhidas;
  const fat = fatiadores.find((f) => f.id === aba) ?? fatiadores[0];
  const modelos = useMemo(() => agruparImpressoras(fat?.impressoras ?? []), [fat]);
  const marcados = new Set(atual[fat?.id ?? ""] ?? []);
  const filtro = busca.trim().toLowerCase();
  const visiveis = modelos.length > 12 && filtro ? modelos.filter((m) => m.modelo.toLowerCase().includes(filtro)) : modelos;

  const salvar = useMutation({
    mutationFn: async (v: Record<string, string[]>) => {
      const { error } = await supabase.from("devices").update({ impressoras_escolhidas: v }).eq("id", deviceId);
      if (error) throw error;
    },
    onSuccess: () => { setSalvo(true); setTimeout(() => setSalvo(false), 2000); qc.invalidateQueries({ queryKey: ["devices"] }); },
    onError: () => { setLocal(null); toast.error("Não foi possível salvar suas impressoras."); },
  });

  function gravar(lista: string[]) {
    if (!fat) return;
    const next = { ...atual, [fat.id]: lista.slice(0, 100) };
    setLocal(next);
    salvar.mutate(next);
  }

  if (!fatiadores.length) return null;
  return (
    <section id={secId} aria-labelledby={`${secId}-t`} className="scroll-mt-6 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 id={`${secId}-t`} className="text-[17px] font-semibold">Minhas impressoras</h3>
        <span aria-live="polite" className={cn("inline-flex items-center gap-1 text-xs text-muted-foreground transition-opacity", salvo ? "opacity-100" : "opacity-0")}>
          <Check className="size-3.5" />Salvo
        </span>
      </div>
      <p className="text-sm text-muted-foreground">Escolha as impressoras e bicos que você usa. Só elas aparecem na Nova análise.</p>
      {fatiadores.length > 1 && (
        <div role="tablist" aria-label="Fatiador" className="flex flex-wrap gap-2">
          {fatiadores.map((f) => (
            <button key={f.id} type="button" role="tab" aria-selected={f.id === fat?.id} onClick={() => { setAba(f.id); setBusca(""); }}
              className={cn("rounded-full border px-3 py-1.5 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                f.id === fat?.id ? "border-primary bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted")}>
              {nomeFatiador(f)}{(atual[f.id]?.length ?? 0) > 0 && ` · ${atual[f.id]!.length}`}
            </button>
          ))}
        </div>
      )}
      {modelos.length > 12 && (
        <Input aria-label="Buscar impressora" placeholder="Buscar impressora" value={busca} onChange={(e) => setBusca(e.target.value)} className="max-w-sm" />
      )}
      {modelos.length === 0 ? (
        <p className="rounded-2xl border border-dashed p-4 text-sm text-muted-foreground">Este fatiador não enviou impressoras.</p>
      ) : (
        <ul className="divide-y rounded-2xl border bg-card shadow-sm">
          {visiveis.map((m, i) => {
            const algum = m.bicos.some((b) => marcados.has(b.perfil));
            const id = `${secId}-m${i}`;
            return (
              <li key={m.modelo} className="flex flex-wrap items-center gap-3 p-3">
                <Checkbox id={id} checked={algum} onCheckedChange={(c) => {
                  const sem = [...marcados].filter((p) => !m.bicos.some((b) => b.perfil === p));
                  const padrao = bicoPadrao(m);
                  gravar(c && padrao ? [...sem, padrao] : sem);
                }} />
                <label htmlFor={id} className="min-w-0 flex-1 cursor-pointer">
                  <span className="block truncate font-medium">{m.modelo}</span>
                  <span className="text-xs text-muted-foreground">{m.marca}</span>
                </label>
                <div className="flex flex-wrap gap-1.5" aria-label={`Bicos de ${m.modelo}`}>
                  {m.bicos.map((b) => {
                    const on = marcados.has(b.perfil);
                    return (
                      <button key={b.perfil} type="button" aria-pressed={on} title={b.perfil}
                        onClick={() => gravar(on ? [...marcados].filter((p) => p !== b.perfil) : [...marcados, b.perfil])}
                        className={cn("rounded-full border px-2.5 py-1 text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                          on ? "border-primary bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted")}>
                        {b.bico === "—" ? "—" : `${b.bico} mm`}
                      </button>
                    );
                  })}
                </div>
              </li>
            );
          })}
          {visiveis.length === 0 && <li className="p-3 text-sm text-muted-foreground">Nenhuma impressora com esse nome.</li>}
        </ul>
      )}
    </section>
  );
}
