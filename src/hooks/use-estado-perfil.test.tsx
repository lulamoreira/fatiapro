import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useEstadoPerfil } from "./use-estado-perfil";

const mocks = vi.hoisted(() => ({ update: vi.fn(), eq: vi.fn(), saved: null as string | null, fail: false, error: vi.fn() }));
vi.mock("@tanstack/react-router", () => ({ useRouteContext: () => ({ user: { id: "own-user" } }) }));
vi.mock("sonner", () => ({ toast: { error: mocks.error } }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: (table: string) => {
  if (table !== "profiles") throw new Error("Unexpected table");
  return {
    select: () => ({ eq: (key: string, id: string) => {
      mocks.eq(key, id);
      return { maybeSingle: async () => ({ data: { uf: "SP" }, error: null }) };
    } }),
    update: (v: { uf: string | null }) => {
      mocks.update(v);
      return { eq: (key: string, id: string) => {
        mocks.eq(key, id);
        return { select: () => ({ single: async () => {
          if (mocks.fail) return { data: null, error: new Error("Denied") };
          mocks.saved = v.uf;
          return { data: v, error: null };
        } }) };
      } };
    },
  };
} } }));

function abrir() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return renderHook(() => useEstadoPerfil(), { wrapper: ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider> });
}

describe("estado do perfil independente do negócio", () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.saved = null; mocks.fail = false; });
  it("lê e salva imediatamente só na própria linha, sem nome de negócio", async () => {
    const { result } = abrir();
    await waitFor(() => expect(result.current.data).toBe("SP"));
    await act(async () => { await result.current.salvar.mutateAsync("RJ"); });
    expect(mocks.update).toHaveBeenCalledWith({ uf: "RJ" });
    expect(mocks.eq).toHaveBeenCalledWith("id", "own-user");
    expect(mocks.saved).toBe("RJ");
    await waitFor(() => expect(result.current.data).toBe("RJ"));
  });
  it("permite retirar o estado", async () => {
    const { result } = abrir();
    await waitFor(() => expect(result.current.data).toBe("SP"));
    await act(async () => { await result.current.salvar.mutateAsync(null); });
    expect(mocks.update).toHaveBeenCalledWith({ uf: null });
    await waitFor(() => expect(result.current.data).toBeNull());
  });
  it("falha de gravação mantém o estado salvo e informa erro", async () => {
    const { result } = abrir();
    await waitFor(() => expect(result.current.data).toBe("SP"));
    mocks.fail = true;
    await act(async () => { await expect(result.current.salvar.mutateAsync("RJ")).rejects.toThrow("Denied"); });
    expect(result.current.data).toBe("SP");
    expect(mocks.error).toHaveBeenCalledOnce();
  });
});