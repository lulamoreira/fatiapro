import { createFileRoute, Link, Outlet, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Home, Box, Bookmark, FileText, FilePlus2, History, Settings, Wallet, LogOut, ShieldCheck, Shield, CircleHelp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { devicesQuery } from "@/lib/queries";
import { isConectado, nomeFatiador, parseRelatorio } from "@/lib/fatia";
import { useNow } from "@/hooks/use-now";
import { Dot } from "@/components/fatia/Chip";
import { AppSkeleton, PageSkeleton } from "@/components/fatia/AppSkeleton";
import { cn } from "@/lib/utils";
import { useIsAdmin } from "@/hooks/use-is-admin";
import { AceiteTermosModal } from "@/components/fatia/AceiteTermos";
import { LinksLegais } from "@/components/fatia/PaginaLegal";
import { DicaInstalar } from "@/components/fatia/DicaInstalar";

export const Route = createFileRoute("/_authenticated/app")({
  component: AppLayout,
  pendingComponent: AppSkeleton,
});

const NAV = [
  { to: "/app", label: "Início", curto: "Início", icon: Home },
  { to: "/app/nova-analise", label: "Nova análise", curto: "Nova", icon: FilePlus2 },
  { to: "/app/historico", label: "Histórico", curto: "Histórico", icon: History },
  { to: "/app/biblioteca", label: "Biblioteca de peças", curto: "Peças", icon: Box },
  { to: "/app/orcamentos", label: "Orçamentos", curto: "Orçamentos", icon: FileText },
  { to: "/app/modelos", label: "Meus modelos", curto: "Modelos", icon: Bookmark },
  { to: "/app/plano", label: "Plano e créditos", curto: "Plano", icon: Wallet },
  { to: "/app/configuracoes", label: "Configurações", curto: "Configurações", icon: Settings },
] as const;

/** Desktop sidebar: same items with "Ajuda" just above Configurações (not in the full mobile bar). */
const NAV_LATERAL = [...NAV.slice(0, -1), { to: "/app/ajuda", label: "Ajuda", curto: "Ajuda", icon: CircleHelp }, NAV[NAV.length - 1]] as const;

export const Logo = ({ className }: { className?: string }) => (
  <span className={cn("text-xl font-bold tracking-[-0.02em]", className)}>Fatia<span className="text-brand">Pro</span></span>
);

/** Status of the first connected (or first) computer, shared by sidebar and mobile dot. */
function useStatusComputador() {
  const now = useNow(10_000);
  const { data: devices = [] } = useQuery(devicesQuery);
  const on = devices.find((d) => isConectado(d.ultimo_contato, now));
  const d = on ?? devices[0];
  const fat = d ? parseRelatorio(d.relatorio).fatiadores.map(nomeFatiador) : [];
  return { device: d, conectado: !!on, fatiadores: fat };
}

function StatusCard() {
  const { device, conectado, fatiadores } = useStatusComputador();
  return (
    <Link to="/app/configuracoes" className="flex items-center gap-3 rounded-2xl bg-card p-3 shadow-sm transition-colors hover:bg-secondary">
      <Dot on={conectado} />
      <span className="min-w-0">
        <span className="block truncate text-sm font-semibold">{device?.nome ?? "Nenhum computador"}</span>
        <span className="block truncate text-xs text-muted-foreground">
          {conectado ? `Conectado${fatiadores.length ? ` · ${fatiadores.join(", ")}` : ""}` : "Desconectado"}
        </span>
      </span>
    </Link>
  );
}

function AppLayout() {
  const navigate = useNavigate();
  const status = useStatusComputador();
  const { isLoading } = useQuery(devicesQuery);
  const isAdmin = useIsAdmin();
  async function sair() {
    await supabase.auth.signOut();
    navigate({ to: "/auth" });
  }
  return (
    <div className="min-h-screen pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)] md:flex">
      <AceiteTermosModal />
      {/* Desktop glass sidebar */}
      <aside className="glass sticky top-5 m-5 hidden h-[calc(100vh-40px)] w-60 shrink-0 flex-col rounded-[22px] p-3 md:flex" aria-label="Menu">
        <div className="px-3 pb-5 pt-3"><Link to="/app" aria-label="FatiaPro — Início" className="rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><Logo /></Link></div>
        <nav className="flex flex-1 flex-col gap-1" aria-label="Menu principal">
          {NAV_LATERAL.map((n) => (
            <Link
              key={n.to}
              to={n.to}
              activeOptions={{ exact: n.to === "/app" }}
              className="flex min-h-10 items-center gap-3 rounded-xl px-3 text-sm font-medium text-foreground transition-all duration-200 hover:bg-sidebar-accent/60"
            activeProps={{ className: "bg-sidebar-accent text-primary-ink shadow-sm" }}
            >
              <n.icon className="size-[18px]" aria-hidden />
              {n.label}
            </Link>
          ))}
          {isAdmin && (
            <Link
              to="/app/admin"
              className="flex min-h-10 items-center gap-3 rounded-xl px-3 text-sm font-medium text-foreground transition-all duration-200 hover:bg-sidebar-accent/60"
            activeProps={{ className: "bg-sidebar-accent text-primary-ink shadow-sm" }}
            >
              <Shield className="size-[18px]" aria-hidden />Admin
            </Link>
          )}
        </nav>
        <div className="space-y-2">
          <StatusCard />
          <p className="flex items-center gap-1.5 px-2 text-xs font-medium text-muted-foreground">
            <ShieldCheck className="size-4 text-success" aria-hidden />Nada é enviado para a impressora
          </p>
          <button onClick={sair} className="flex min-h-10 w-full items-center gap-3 rounded-xl px-3 text-left text-sm font-medium text-muted-foreground hover:bg-sidebar-accent/60">
            <LogOut className="size-4" aria-hidden />Sair
          </button>
          <LinksLegais className="flex gap-3 px-3 text-xs text-muted-foreground" />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col pt-[env(safe-area-inset-top)] md:pt-0">
        {/* Mobile top bar: logo + computer status dot */}
        <DicaInstalar />
        <header className="flex items-center justify-between px-4 pt-4 md:hidden">
          <Link to="/app" aria-label="FatiaPro — Início"><Logo className="text-lg" /></Link>
          <div className="flex items-center gap-1">
            <Link to="/app/configuracoes" aria-label={status.conectado ? "Computador conectado" : "Computador desconectado"} className="flex min-h-11 items-center gap-2 rounded-full px-3 text-xs font-medium text-muted-foreground">
              <Dot on={status.conectado} />{status.conectado ? "Conectado" : "Desconectado"}
            </Link>
            <Link to="/app/ajuda" aria-label="Ajuda" className="flex size-11 items-center justify-center rounded-full text-muted-foreground"><CircleHelp className="size-4" /></Link>
            {isAdmin && <Link to="/app/admin" aria-label="Admin" className="flex size-11 items-center justify-center rounded-full text-muted-foreground"><Shield className="size-4" /></Link>}
            <button onClick={sair} aria-label="Sair" className="flex size-11 items-center justify-center rounded-full text-muted-foreground"><LogOut className="size-4" /></button>
          </div>
        </header>
        <main className="flex-1 overflow-x-hidden px-4 pb-[calc(12rem+env(safe-area-inset-bottom))] pt-5 md:px-8 md:pb-10 md:pt-8">
          {isLoading ? <PageSkeleton /> : <Outlet />}
          <p className="mt-10 flex items-center justify-center gap-2 text-xs font-medium text-muted-foreground md:hidden">
            <ShieldCheck className="size-4 text-success" aria-hidden />Nada é enviado para a impressora
          </p>
          <LinksLegais className="mt-2 flex justify-center gap-4 text-xs text-muted-foreground md:hidden" />
        </main>
      </div>

      {/* Mobile glass bottom nav */}
      <nav className="glass fixed bottom-[calc(0.75rem+env(safe-area-inset-bottom))] left-[calc(0.75rem+env(safe-area-inset-left))] right-[calc(0.75rem+env(safe-area-inset-right))] z-30 flex justify-between rounded-[22px] p-1.5 md:hidden" aria-label="Menu principal">
        {NAV.map((n) => (
          <Link
            key={n.to}
            to={n.to}
            className="flex min-h-12 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-2xl text-[11px] font-medium text-muted-foreground"
            activeOptions={{ exact: n.to === "/app" }}
            activeProps={{ className: "bg-sidebar-accent text-primary-ink shadow-sm" }}
          >
            <n.icon className="size-5" aria-hidden />
            <span className="truncate">{n.curto}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
}
