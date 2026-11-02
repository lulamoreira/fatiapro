import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MeuNegocio } from "./MeuNegocio";

const mocks = vi.hoisted(() => ({
  negocio: { nome: "Oficina", documento: "12345678901234", email: "", whatsapp: "11977749746", cidade: "", logo_path: null },
  update: vi.fn(),
}));
vi.mock("@/hooks/use-negocio", () => ({ useNegocio: () => ({ data: mocks.negocio, isLoading: false }) }));
vi.mock("@/hooks/use-estado-perfil", () => ({ useEstadoPerfil: () => ({ data: null, salvar: { isPending: false, mutate: vi.fn() } }) }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {
  auth: { getUser: async () => ({ data: { user: { id: "teste" } } }) },
  from: () => ({ update: mocks.update }),
} }));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

function abrir() {
  return render(<QueryClientProvider client={new QueryClient()}><MeuNegocio /></QueryClientProvider>);
}

describe("máscaras de Meu negócio", () => {
  it("carrega dígitos formatados, edita, salva e lê novamente", async () => {
    mocks.update.mockImplementation((linha: { documento: string; whatsapp: string }) => {
      Object.assign(mocks.negocio, linha);
      return { eq: async () => ({ error: null }) };
    });
    const tela = abrir();
    const documento = screen.getByLabelText("CPF/CNPJ") as HTMLInputElement;
    const telefone = screen.getByLabelText("WhatsApp") as HTMLInputElement;
    expect(documento.value).toBe("12.345.678/9012-34");
    expect(telefone.value).toBe("(11) 97774-9746");
    fireEvent.change(documento, { target: { value: "12345678901" } });
    fireEvent.change(telefone, { target: { value: "1133334444" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
    await waitFor(() => expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({ documento: "123.456.789-01", whatsapp: "(11) 3333-4444" })));
    tela.unmount();
    abrir();
    expect((screen.getByLabelText("CPF/CNPJ") as HTMLInputElement).value).toBe("123.456.789-01");
    expect((screen.getByLabelText("WhatsApp") as HTMLInputElement).value).toBe("(11) 3333-4444");
  });
  it("apaga até vazio, inclusive ao chegar nos separadores", () => {
    abrir();
    for (const label of ["CPF/CNPJ", "WhatsApp"]) {
      const campo = screen.getByLabelText(label) as HTMLInputElement;
      for (let i = 0; i < 20; i++) fireEvent.change(campo, { target: { value: campo.value.slice(0, -1) } });
      expect(campo.value).toBe("");
    }
  });
});