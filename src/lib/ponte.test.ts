import { describe, it, expect } from "vitest";
import { compararVersao, maisAlta, parseCodigoAssinatura, detectarSistema } from "./ponte";

describe("ponte", () => {
  it("compara versões numericamente", () => {
    expect(compararVersao("1.10.0", "1.9.9")).toBeGreaterThan(0);
    expect(compararVersao("1.2.3", "1.2.3")).toBe(0);
  });
  it("escolhe a mais alta", () => {
    expect(maisAlta([{ versao: "1.9.0" }, { versao: "1.10.0" }, { versao: "1.2.0" }])?.versao).toBe("1.10.0");
  });
  it("lê o código de assinatura", () => {
    const h = "a".repeat(64);
    expect(parseCodigoAssinatura(`sha256 ${h}\nassinatura QUJD+/=`)).toEqual({ sha256: h, assinatura: "QUJD+/=" });
    expect(parseCodigoAssinatura("sha256 123")).toBeNull();
  });
  it("detecta o sistema", () => {
    expect(detectarSistema({ userAgentData: { platform: "macOS" } })).toBe("macos");
    expect(detectarSistema({ platform: "Win32" })).toBe("windows");
  });
});
