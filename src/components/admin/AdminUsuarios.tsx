import { useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Search } from "lucide-react";
import { adminPainel } from "@/lib/admin.functions";
import { SITUACAO, iniciais, relativo, type AdminUsuarioLinha, type FiltroAdmin } from "@/lib/admin";
import { motorLabel } from "@/lib/fatia";
import { Dot, Segmented, Tag } from "@/components/fatia/Chip";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { UsuarioPainel } from "./UsuarioPainel";

const FILTROS: { id: FiltroAdmin; label: string }[] = [
  { id: "todos", label: "Todos" },
  { id: "ativos", label: "Ativos" },
  { id: "sem_computador", label: "Sem computador" },
  { id: "bloqueados", label: "Bloqueados" },
  { id: "admins", label: "Administradores" },
];

const data = (iso: string) => new Date(iso).toLocaleDateString("pt-BR");

export function Avatar({ nome, email }: { nome: string | null; email: string }) {
  return <span aria-hidden className="flex size-10 shrink-0 items-center justify-center rounded-full bg-g-blue text-sm font-bold text-primary-foreground">{iniciais(nome, email)}</span>;
}

export function AdminUsuarios({ filtroInicial = "todos", onFiltro }: { filtroInicial?: FiltroAdmin | undefined; onFiltro?: (f: FiltroAdmin) => void } = {}) {
  const fn = useServerFn(adminPainel);
  const [pagina, setPagina] = useState(1);
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<FiltroAdmin>(filtroInicial ?? "todos");
  const [aberto, setAberto] = useState<string | null>(null);
  const q = useQuery({
    queryKey: ["admin", "painel", pagina, busca, filtro],
    queryFn: () => fn({ data: { pagina, busca, filtro } }),
    placeholderData: keepPreviousData,
    staleTime: 15_000,
  });

  const ind = q.data?.indicadores;
  const totalPag = q.data ? Math.max(1, Math.ceil(q.data.total / q.data.porPagina)) : 1;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Indicador titulo="Usuários" valor={ind?.usuarios} extra={ind ? <Tag tone="success">+{ind.novos_semana} esta semana</Tag> : null} />
        <Indicador titulo="Ativos em 7 dias" valor={ind?.ativos_7d} />
        <Indicador titulo="Análises hoje" valor={ind?.analises_hoje} />
        <Indicador titulo="Computadores conectados agora" valor={ind?.conectados_agora} />
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative lg:w-80">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input aria-label="Buscar por nome ou e-mail" placeholder="Buscar por nome ou e-mail" className="pl-9" value={busca} onChange={(e) => { setBusca(e.target.value); setPagina(1); }} />
        </div>
        <Segmented label="Filtro" options={FILTROS} value={filtro} onChange={(f) => { setFiltro(f); setPagina(1); onFiltro?.(f); }} />
      </div>

      {q.isError && <p role="alert" className="text-sm text-destructive-ink">{(q.error as Error).message}</p>}
      {q.isLoading ? (
        <div className="space-y-2">{Array.from({ length: 5 }, (_, i) => <Skeleton key={`s${i}`} className="h-16 w-full" />)}</div>
      ) : q.data && q.data.linhas.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">Nenhum usuário encontrado.</p>
      ) : (
        <div className="overflow-hidden rounded-2xl bg-card shadow-sm">
          <div className="hidden grid-cols-[2fr_0.9fr_0.9fr_0.9fr_0.7fr_0.8fr_1fr_0.9fr_auto] gap-3 border-b px-4 py-2.5 text-xs font-semibold text-muted-foreground lg:grid">
            <span>Usuário</span><span>Cadastro</span><span>Último acesso</span><span>Computadores</span><span>Análises</span><span>Motor</span><span>Situação</span><span>Créditos</span><span className="w-14" />
          </div>
          <ul>{q.data?.linhas.map((l) => <Linha key={l.id} l={l} onVer={() => setAberto(l.id)} />)}</ul>
        </div>
      )}

      {q.data && q.data.total > q.data.porPagina && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Página {pagina} de {totalPag} · {q.data.total} usuários</span>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" disabled={pagina <= 1} onClick={() => setPagina((p) => p - 1)}>Anterior</Button>
            <Button variant="secondary" size="sm" disabled={pagina >= totalPag} onClick={() => setPagina((p) => p + 1)}>Próxima</Button>
          </div>
        </div>
      )}

      <UsuarioPainel id={aberto} onClose={() => setAberto(null)} />
    </div>
  );
}

function Indicador({ titulo, valor, extra }: { titulo: string; valor?: number | undefined; extra?: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-card p-4 shadow-sm">
      <p className="text-xs font-medium text-muted-foreground">{titulo}</p>
      <p className="mt-1 text-[28px] font-bold leading-tight">{valor ?? "—"}</p>
      {extra && <div className="mt-1">{extra}</div>}
    </div>
  );
}

function Linha({ l, onVer }: { l: AdminUsuarioLinha; onVer: () => void }) {
  const s = SITUACAO[l.situacao];
  return (
    <li className="grid grid-cols-[1fr_auto] items-center gap-3 border-b px-4 py-3 last:border-b-0 lg:grid-cols-[2fr_0.9fr_0.9fr_0.9fr_0.7fr_0.8fr_1fr_0.9fr_auto]">
      <div className="flex min-w-0 items-center gap-3">
        <Avatar nome={l.nome} email={l.email} />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{l.nome || "Sem nome"}</p>
          <p className="truncate text-xs text-muted-foreground">{l.email}</p>
          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground lg:hidden">
            <Tag tone={s.tone}>{s.label}</Tag>
            <span>{relativo(l.ultimo_acesso)}</span>
            <span className="inline-flex items-center gap-1"><Dot on={l.computadores_on > 0} />{l.computadores}</span>
            <span>{l.analises} análises</span>
            <span>{l.credito}</span>
          </p>
        </div>
      </div>
      <span className="hidden text-sm lg:block">{data(l.criado_em)}</span>
      <span className="hidden text-sm lg:block">{relativo(l.ultimo_acesso)}</span>
      <span className="hidden items-center gap-2 text-sm lg:flex"><Dot on={l.computadores_on > 0} />{l.computadores}</span>
      <span className="hidden text-sm lg:block">{l.analises}</span>
      <span className="hidden text-sm lg:block">{motorLabel(l.motor_mais_usado)}</span>
      <span className="hidden lg:block"><Tag tone={s.tone}>{s.label}</Tag></span>
      <span className="hidden text-sm lg:block">{l.credito}</span>
      <Button variant="ghost" size="sm" onClick={onVer} aria-label={`Ver ${l.email}`}>Ver →</Button>
    </li>
  );
}
