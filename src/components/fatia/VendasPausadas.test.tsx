import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { fireEvent } from "@testing-library/react";

const resgatar = vi.fn(async () => ({ ok: true as const, creditos: 5, expira_em: "2027-01-01T00:00:00Z" }));
vi.mock("@tanstack/react-start", () => ({ useServerFn: () => resgatar, createServerFn: () => ({}) }));
vi.mock("@/lib/compra.functions", () => ({ criarCompra: {}, conferirPedido: {} }));
vi.mock("@/lib/cupons.functions", () => ({ resgatarCupom: {} }));
vi.mock("@/hooks/use-status-vendas", () => ({ useStatusVendas: () => ({ data: { suspensas: true, mensagem: "x" } }) }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
vi.mock("@tanstack/react-router", () => ({ Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a> }));

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { PacotesGrade } from "./Compras";
import { CupomForm } from "./CupomForm";

const pacotes = [{ id: "a", nome: "Básico", creditos: 10, preco_centavos: 1990, validade_meses: 12, destaque: true }];

describe("vendas pausadas na tela", () => {
  it("mostra pacotes desabilitados com a mensagem do admin", () => {
    const onComprar = vi.fn();
    render(<PacotesGrade pacotes={pacotes} suspensas mensagem="Voltamos em breve." ocupado={false} comprandoId={null} onComprar={onComprar} />);
    expect(screen.getByText("Vendas pausadas")).toBeInTheDocument();
    expect(screen.getByText("Voltamos em breve.")).toBeInTheDocument();
    expect(screen.getByText("Básico")).toBeInTheDocument();
    expect(screen.getByText("Mais escolhido")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Indisponível no momento" })).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Comprar" })).toBeNull();
  });
  it("vendas ativas: botão Comprar funciona", async () => {
    const onComprar = vi.fn();
    render(<PacotesGrade pacotes={pacotes} suspensas={false} mensagem={null} ocupado={false} comprandoId={null} onComprar={onComprar} />);
    expect(screen.queryByText("Vendas pausadas")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Comprar" }));
    expect(onComprar).toHaveBeenCalledWith("a");
  });
  it("cupom continua resgatável com vendas suspensas", async () => {
    render(<QueryClientProvider client={new QueryClient()}><CupomForm /></QueryClientProvider>);
    fireEvent.change(screen.getByPlaceholderText("CÓDIGO"), { target: { value: "PROMO" } });
    fireEvent.click(screen.getByRole("button", { name: "Aplicar" }));
    await waitFor(() => expect(resgatar).toHaveBeenCalled());
    expect(resgatar).toHaveBeenCalledWith({ data: { codigo: "PROMO" } });
    expect(await screen.findByText(/Cupom aplicado: \+5 créditos/)).toBeInTheDocument();
  });
});
