import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ShieldAlert } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, Segmented, Tag, EmptyState } from "@/components/fatia/Chip";
import { PageSkeleton } from "@/components/fatia/AppSkeleton";
import { Button } from "@/components/ui/button";
import { AdminUsuarios } from "@/components/admin/AdminUsuarios";
import { AdminAuditoria } from "@/components/admin/AdminAuditoria";
import { AdminPonte } from "@/components/admin/AdminPonte";
import { AdminFeedback } from "@/components/admin/AdminFeedback";
import { AdminFinanceiro } from "@/components/admin/AdminFinanceiro";
import { AdminPacotes } from "@/components/admin/AdminPacotes";
import { useServerFn } from "@tanstack/react-start";
import { adminAlertaGasto } from "@/lib/admin-cobranca.functions";
import { formatUSD } from "@/lib/fatia";

export const Route = createFileRoute("/_authenticated/app/admin")({
  head: () => ({
    meta: [
      { title: "Admin · Usuários — FatiaPro" },
      { name: "description", content: "Área de administração do FatiaPro." },
      { property: "og:title", content: "Admin · FatiaPro" },
      { property: "og:description", content: "Área de administração do FatiaPro." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminPage,
});

function AdminPage() {
  // Fresh check (no cache) so the page never renders admin calls for non-admins.
  const { data: isAdmin, isLoading } = useQuery({
    queryKey: ["is-admin", "fresh"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("is_admin");
      return !error && data === true;
    },
    staleTime: 0,
  });
  const [aba, setAba] = useState<"usuarios" | "historico" | "ponte" | "feedback" | "financeiro" | "pacotes">("usuarios");

  if (isLoading) return <PageSkeleton />;
  if (!isAdmin)
    return (
      <EmptyState
        tone="orange"
        icon={<ShieldAlert />}
        titulo="Você não tem acesso a esta área."
        texto="Esta área é só para administradores."
        acao={<Button asChild variant="secondary"><Link to="/app/nova-analise">Voltar</Link></Button>}
      />
    );

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader titulo="Admin · Usuários" subtitulo="Só administradores veem esta área." acao={<Tag tone="primary">Administrador</Tag>} />
      <AlertaGasto />
      <Segmented
        label="Seção"
        value={aba}
        onChange={setAba}
        options={[{ id: "usuarios", label: "Usuários" }, { id: "historico", label: "Histórico de ações" }, { id: "ponte", label: "Versões da ponte" }, { id: "feedback", label: "Feedback" }, { id: "financeiro", label: "Financeiro" }, { id: "pacotes", label: "Pacotes" }]}
      />
      {aba === "usuarios" ? <AdminUsuarios /> : aba === "historico" ? <AdminAuditoria /> : aba === "ponte" ? <AdminPonte /> : aba === "feedback" ? <AdminFeedback /> : aba === "pacotes" ? <AdminPacotes /> : <AdminFinanceiro />}
    </div>
  );
}

/** Red banner on every admin tab when today's AI spend passes alerta_gasto_usd_dia. */
function AlertaGasto() {
  const fn = useServerFn(adminAlertaGasto);
  const { data } = useQuery({ queryKey: ["admin", "alerta-gasto"], queryFn: () => fn(), refetchInterval: 60_000 });
  if (!data?.alerta) return null;
  return (
    <p role="alert" className="rounded-2xl bg-destructive/15 p-3 text-sm font-semibold text-destructive-ink">
      Gasto com IA hoje: {formatUSD(data.hoje_usd)} (limite de alerta {formatUSD(data.limite_usd)})
    </p>
  );
}
