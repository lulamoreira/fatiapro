import { describe, expect, it } from "vitest";
import { strToU8, zipSync } from "fflate";
import { coresDo3mf, tipoDoPerfil } from "./cores-3mf";

const lerZip = (zip: Uint8Array) => coresDo3mf(async (a, b) => zip.slice(a, b + 1), zip.length);
describe("coresDo3mf", () => {
  it.each([0, 6])("lê o config de um zip válido (compressão %s)", async (level) => {
    const zip = zipSync({ "Metadata/project_settings.config": strToU8(JSON.stringify({ filament_colour: ["#ff0000", "#00ff00"], filament_settings_id: ["Generic PLA", "Bambu PLA Silk"] })) }, { level: level === 0 ? 0 : 6 });
    expect(await lerZip(zip)).toEqual([{ slot: 1, cor: "#ff0000", perfil: "Generic PLA" }, { slot: 2, cor: "#00ff00", perfil: "Bambu PLA Silk" }]);
  });
  it("sem config devolve null", async () => expect(await lerZip(zipSync({ "3D/3dmodel.model": strToU8("mesh") }))).toBeNull());
  it("arquivo inválido devolve null", async () => expect(await lerZip(strToU8("não é um arquivo 3mf"))).toBeNull());
  it("falha de leitura não lança erro", async () => expect(await coresDo3mf(async () => { throw new Error("rede"); }, 100)).toBeNull());
  it("config inválido devolve null", async () => expect(await lerZip(zipSync({ "Metadata/project_settings.config": strToU8('{"filament_colour":[42]}') }))).toBeNull());
});
describe("tipoDoPerfil", () => {
  it.each([["Bambu PLA SILK", "PLA Silk"], ["generic petg", "PETG"], ["TPU 95A", "TPU"], ["Generic ABS", "ABS/ASA"], ["ASA", "ABS/ASA"], ["PLA Matte", "PLA"], ["", "PLA"]])("%s vira %s", (perfil, tipo) => expect(tipoDoPerfil(perfil)).toBe(tipo));
});