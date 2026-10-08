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
  const [aba, setAba] = useState<"usuarios" | "historico" | "ponte">("usuarios");

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
      <Segmented
        label="Seção"
        value={aba}
        onChange={setAba}
        options={[{ id: "usuarios", label: "Usuários" }, { id: "historico", label: "Histórico de ações" }, { id: "ponte", label: "Versões da ponte" }]}
      />
      {aba === "usuarios" ? <AdminUsuarios /> : aba === "historico" ? <AdminAuditoria /> : <AdminPonte />}
    </div>
  );
}
