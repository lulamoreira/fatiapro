import { describe, expect, it, vi } from "vitest";
import { MSG_MUITAS_TENTATIVAS, codigoErroCupom, resgatarCupomLogica, type CupomDeps } from "./cupons";

function deps(resp: Awaited<ReturnType<CupomDeps["resgatar"]>>) {
  let erradas = 0;
  const d = {
    tentativasErradasUltimaHora: vi.fn(async () => erradas),
    registrarTentativaErrada: vi.fn(async () => { erradas++; }),
    resgatar: vi.fn(async () => resp),
  };
  return d;
}

describe("resgatarCupom", () => {
  it("código em minúsculas é normalizado", async () => {
    const d = deps({ ok: true, creditos: 5, expira_em: "2026-12-31T00:00:00Z" });
    const r = await resgatarCupomLogica("u", "  bem-vindo ", d);
    expect(r.ok).toBe(true);
    expect(d.resgatar).toHaveBeenCalledWith("u", "BEM-VINDO");
  });
  it("11ª tentativa errada na hora → bloqueada sem chamar o banco", async () => {
    const d = deps({ ok: false, erro: "cupom_invalido" });
    for (let i = 0; i < 10; i++) expect((await resgatarCupomLogica("u", "ERRADO", d)).ok).toBe(false);
    const r = await resgatarCupomLogica("u", "ERRADO", d);
    expect(r).toEqual({ ok: false, mensagem: MSG_MUITAS_TENTATIVAS });
    expect(d.resgatar).toHaveBeenCalledTimes(10);
  });
  it("erro do banco vira mensagem clara", async () => {
    const r = await resgatarCupomLogica("u", "X-1-2", deps({ ok: false, erro: "cupom_ja_usado" }));
    expect(r).toEqual({ ok: false, mensagem: "Você já usou este cupom." });
  });
  it("reconhece os códigos de erro do SQL", () => {
    expect(codigoErroCupom("ERROR: cupom_esgotado")).toBe("cupom_esgotado");
    expect(codigoErroCupom("cupom_so_primeira_compra")).toBe("cupom_so_primeira_compra");
    expect(codigoErroCupom("outro")).toBe("cupom_invalido");
  });
});
