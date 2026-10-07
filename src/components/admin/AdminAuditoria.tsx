import { useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { adminAuditoria } from "@/lib/admin.functions";
import { ACAO_LABEL } from "@/lib/admin";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export function AdminAuditoria() {
  const fn = useServerFn(adminAuditoria);
  const [pagina, setPagina] = useState(1);
  const q = useQuery({ queryKey: ["admin", "auditoria", pagina], queryFn: () => fn({ data: { pagina } }), placeholderData: keepPreviousData });
  const totalPag = q.data ? Math.max(1, Math.ceil(q.data.total / q.data.porPagina)) : 1;

  if (q.isLoading) return <div className="space-y-2">{Array.from({ length: 4 }, (_, i) => <Skeleton key={`a${i}`} className="h-14 w-full" />)}</div>;
  if (q.isError) return <p role="alert" className="text-sm text-destructive-ink">{(q.error as Error).message}</p>;
  if (!q.data || q.data.linhas.length === 0) return <p className="py-10 text-center text-sm text-muted-foreground">Nenhuma ação registrada ainda.</p>;

  return (
    <div className="space-y-3">
      <ul className="overflow-hidden rounded-2xl bg-card shadow-sm">
        {q.data.linhas.map((r) => (
          <li key={r.id} className="flex flex-col gap-1 border-b px-4 py-3 last:border-b-0 md:flex-row md:items-center md:justify-between">
            <p className="text-sm">
              <span className="font-semibold">{r.admin_email}</span> · {ACAO_LABEL[r.acao] ?? r.acao} · <span className="font-semibold">{r.alvo_email}</span>
            </p>
            <time className="text-xs text-muted-foreground" dateTime={r.criado_em}>{new Date(r.criado_em).toLocaleString("pt-BR")}</time>
          </li>
        ))}
      </ul>
      {q.data.total > q.data.porPagina && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Página {pagina} de {totalPag}</span>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" disabled={pagina <= 1} onClick={() => setPagina((p) => p - 1)}>Anterior</Button>
            <Button variant="secondary" size="sm" disabled={pagina >= totalPag} onClick={() => setPagina((p) => p + 1)}>Próxima</Button>
          </div>
        </div>
      )}
    </div>
  );
}
