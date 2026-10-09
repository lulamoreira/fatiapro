import { describe, expect, it } from "vitest";
import { avisoPecaAberta, separarVersaoPecaAberta } from "./peca-aberta";

describe("aviso da peça aberta", () => {
  it("só fornece aviso quando a opção de peça aberta está ativa", () => {
    expect(avisoPecaAberta(true, "Snapmaker Orca", "macos")).not.toBeNull();
    expect(avisoPecaAberta(false, "Snapmaker Orca", "macos")).toBeNull();
  });
  it("usa ⌘S no computador macos escolhido", () => {
    expect(avisoPecaAberta(true, "Snapmaker Orca", "macos")?.atalho).toBe("⌘S");
  });
  it("usa Ctrl+S no computador windows escolhido", () => {
    expect(avisoPecaAberta(true, "Snapmaker Orca", "windows")?.atalho).toBe("Ctrl+S");
  });
  it("identifica o fatiador escolhido", () => {
    expect(avisoPecaAberta(true, "Snapmaker Orca", "macos")?.fatiador).toBe("Snapmaker Orca");
  });
  it("sem fatiador escolhido usa fatiador", () => {
    expect(avisoPecaAberta(true, null, null)?.fatiador).toBe("fatiador");
  });
  it("sem sistema conhecido oferece os dois atalhos", () => {
    expect(avisoPecaAberta(true, null, null)?.atalho).toBe("⌘S no Mac, Ctrl+S no Windows");
  });
});

describe("versão da peça aberta", () => {
  it("separa o horário apenas no evento de peça aberta", () => {
    expect(separarVersaoPecaAberta("Usando a peça aberta no Snapmaker Orca (versão das 21:05)."))
      .toEqual({ antes: "Usando a peça aberta no Snapmaker Orca ", versao: "(versão das 21:05)", depois: "." });
    expect(separarVersaoPecaAberta("Outro evento (versão das 21:05)")).toBeNull();
    expect(separarVersaoPecaAberta("Usando a peça aberta sem horário")).toBeNull();
  });
});