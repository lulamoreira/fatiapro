import { describe, expect, it } from "vitest";
import { parametrosCriarAnalise } from "./analise-params";

const CHAVES = [
  "p_user",
  "p_device",
  "p_roteiro",
  "p_fatiador",
  "p_opcoes",
  "p_motor",
  "p_premium",
  "p_arquivo_path",
  "p_nome_peca",
] as const;

const entrada = {
  device_id: "00000000-0000-0000-0000-000000000000",
  roteiro: "config_geral" as const,
  fatiador: null,
  opcoes: {},
  motor: "fatiapro" as const,
  premium: false,
  arquivo_path: null,
  nome_peca: null,
};

describe("parametrosCriarAnalise", () => {
  it("peça aberta no fatiador (sem arquivo): envia as 9 chaves, com null nos opcionais", () => {
    const p = parametrosCriarAnalise("user-1", entrada);
    for (const k of CHAVES) expect(k in p).toBe(true);
    expect(p.p_fatiador).toBeNull();
    expect(p.p_arquivo_path).toBeNull();
    expect(p.p_nome_peca).toBeNull();
    expect(Object.values(p)).not.toContain(undefined);
  });

  it("com arquivo e fatiador, preserva os valores", () => {
    const p = parametrosCriarAnalise("user-1", {
      ...entrada,
      fatiador: "bambu-studio",
      arquivo_path: "pecas/x.3mf",
      nome_peca: "Peça",
    });
    expect(p.p_fatiador).toBe("bambu-studio");
    expect(p.p_arquivo_path).toBe("pecas/x.3mf");
    expect(p.p_nome_peca).toBe("Peça");
  });
});
