import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Box } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

export interface PecaEscolhida {
  id: string;
  nome: string;
  path: string;
}

/** Escape LIKE wildcards in user search text. */
export const escapeLike = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

export function BibliotecaPicker({ onPick, selected }: { onPick: (p: PecaEscolhida) => void; selected: boolean }) {
  const [open, setOpen] = useState(false);
  const [busca, setBusca] = useState("");
  const { data = [], isLoading } = useQuery({
    queryKey: ["biblioteca_picker", busca],
    enabled: open,
    queryFn: async () => {
      let q = supabase
        .from("pecas")
        .select("id, nome, arquivo_original_path, criado_em", { count: "exact" })
        .not("arquivo_original_path", "is", null)
        .order("criado_em", { ascending: false })
        .order("id", { ascending: false })
        .range(0, 49);
      if (busca.trim()) q = q.ilike("nome", `%${escapeLike(busca.trim())}%`);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant={selected ? "default" : "outline"} className="self-center rounded-full"><Box className="size-4" aria-hidden />Escolher da biblioteca</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Escolher da biblioteca</DialogTitle></DialogHeader>
        <Input placeholder="Buscar por nome" value={busca} onChange={(e) => setBusca(e.target.value)} aria-label="Buscar peça" />
        {isLoading ? <p className="text-sm text-muted-foreground">Carregando…</p> : data.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma peça com arquivo original na biblioteca.</p>
        ) : (
          <ul className="max-h-80 space-y-1 overflow-y-auto">
            {data.map((p) => (
              <li key={p.id}>
                <button type="button" className="w-full rounded-xl p-3 text-left hover:bg-accent" onClick={() => { onPick({ id: p.id, nome: p.nome, path: p.arquivo_original_path! }); setOpen(false); }}>
                  <p className="font-medium">{p.nome}</p>
                  <p className="text-xs text-muted-foreground">{new Date(p.criado_em).toLocaleDateString("pt-BR")}</p>
                </button>
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}
