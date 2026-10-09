import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@/hooks/use-is-admin", () => ({ useIsAdmin: () => false }));
vi.mock("@/components/inicio/VisaoUsuario", () => ({ VisaoUsuario: () => <p>visao-usuario</p> }));
vi.mock("@/components/inicio/VisaoAdmin", () => ({ VisaoAdmin: () => <p>visao-admin</p> }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { auth: { getUser: async () => ({ data: { user: null } }) } } }));
vi.mock("@tanstack/react-query", () => ({ useQuery: () => ({ data: "Ana" }) }));
vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (o: unknown) => o,
  Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a>,
}));

describe("Início para usuário comum", () => {
  it("não mostra a visão Negócio mesmo com a escolha lembrada", async () => {
    window.localStorage.setItem("fatiapro-inicio-visao", "negocio");
    const { Route } = await import("@/routes/_authenticated/app.index");
    const Comp = (Route as unknown as { component: () => React.ReactElement }).component;
    render(<Comp />);
    expect(screen.getByText("visao-usuario")).toBeInTheDocument();
    expect(screen.queryByText("visao-admin")).toBeNull();
    expect(screen.queryByRole("radiogroup", { name: "Visão" })).toBeNull();
  });
});
