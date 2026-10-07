import { createFileRoute, Link, Outlet, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Box, Bookmark, FilePlus2, History, Monitor, LogOut, Menu, X, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/app")({
  component: AppLayout,
});

const NAV = [
  { to: "/app/nova-analise", label: "Nova análise", icon: FilePlus2 },
  { to: "/app/historico", label: "Histórico", icon: History },
  { to: "/app/biblioteca", label: "Biblioteca de peças", icon: Box },
  { to: "/app/modelos", label: "Meus modelos", icon: Bookmark },
  { to: "/app/computador", label: "Seu computador", icon: Monitor },
] as const;

function AppLayout() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  async function sair() {
    await supabase.auth.signOut();
    navigate({ to: "/auth" });
  }
  return (
    <div className="flex min-h-screen flex-col bg-background md:flex-row">
      <header className="flex items-center justify-between border-b px-4 py-3 md:hidden">
        <span className="font-display text-lg font-bold">Fatia<span className="text-primary">Pro</span></span>
        <button aria-label={open ? "Fechar menu" : "Abrir menu"} onClick={() => setOpen((v) => !v)} className="rounded-lg p-2 hover:bg-accent">
          {open ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      </header>
      <aside className={cn("border-r bg-sidebar md:sticky md:top-0 md:flex md:h-screen md:w-60 md:flex-col", open ? "block" : "hidden md:flex")}>
        <div className="hidden px-6 py-6 md:block">
          <span className="font-display text-xl font-bold">Fatia<span className="text-primary">Pro</span></span>
        </div>
        <nav className="flex flex-col gap-1 p-3 md:flex-1" aria-label="Menu principal">
          {NAV.map((n) => (
            <Link
              key={n.to}
              to={n.to}
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-sidebar-foreground hover:bg-sidebar-accent"
              activeProps={{ className: "bg-sidebar-accent text-primary" }}
            >
              <n.icon className="size-4" aria-hidden />
              {n.label}
            </Link>
          ))}
          <button onClick={sair} className="mt-auto flex items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-muted-foreground hover:bg-sidebar-accent">
            <LogOut className="size-4" aria-hidden />
            Sair
          </button>
        </nav>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <main className="flex-1 px-4 pb-24 pt-6 md:px-10 md:pt-10">
          <Outlet />
        </main>
        <footer className="fixed inset-x-0 bottom-0 z-20 border-t bg-background/90 backdrop-blur md:left-60">
          <p className="flex items-center justify-center gap-2 py-2.5 text-xs font-medium text-muted-foreground">
            <ShieldCheck className="size-4 text-success" aria-hidden />
            Nada é enviado para a impressora
          </p>
        </footer>
      </div>
    </div>
  );
}
