import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { dispensadoRecente, mostrarDica, plataforma } from "./instalar";

const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile Safari/604.1";
const MAC = "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/605.1.15 Version/17.0 Safari/605.1.15";
const DIA = 86_400_000;

describe("manifesto", () => {
  it("é JSON válido com os campos pedidos", () => {
    const m = JSON.parse(readFileSync("public/manifest.webmanifest", "utf8"));
    expect(m).toMatchObject({ name: "FatiaPro", short_name: "FatiaPro", lang: "pt-BR", start_url: "/app", scope: "/", display: "standalone" });
    expect(m.background_color).toBeTruthy();
    expect(m.theme_color).toBeTruthy();
    expect(m.icons.find((i: { purpose: string }) => i.purpose === "maskable").src).toBe("/icon-maskable-512.png");
  });
});

describe("dica de instalação", () => {
  it("não aparece no computador", () => {
    expect(plataforma(MAC, 0)).toBe("desktop");
    expect(mostrarDica("desktop", false, false)).toBe(false);
  });
  it("não aparece em modo tela inicial", () => {
    expect(mostrarDica(plataforma(IPHONE), true, false)).toBe(false);
  });
  it("aparece no iPhone pelo Safari", () => {
    expect(mostrarDica(plataforma(IPHONE), false, false)).toBe(true);
  });
  it("'Agora não' esconde por 30 dias", () => {
    const agora = Date.now();
    expect(dispensadoRecente(String(agora - 29 * DIA), agora)).toBe(true);
    expect(dispensadoRecente(String(agora - 31 * DIA), agora)).toBe(false);
    expect(dispensadoRecente(null, agora)).toBe(false);
  });
});
