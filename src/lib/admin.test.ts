import { describe, expect, it } from "vitest";
import { relativo, situacaoUsuario } from "./admin";

describe("situacaoUsuario", () => {
  it("bloqueado vence admin", () => expect(situacaoUsuario({ admin: true, bloqueado: true, computadores: 1 })).toBe("bloqueado"));
  it("admin sem computador é admin", () => expect(situacaoUsuario({ admin: true, bloqueado: false, computadores: 0 })).toBe("admin"));
  it("comum sem computador", () => expect(situacaoUsuario({ admin: false, bloqueado: false, computadores: 0 })).toBe("sem_computador"));
});

describe("relativo", () => {
  const now = Date.parse("2026-10-07T12:00:00Z");
  it("agora", () => expect(relativo("2026-10-07T11:59:30Z", now)).toBe("agora"));
  it("horas", () => expect(relativo("2026-10-07T10:00:00Z", now)).toBe("há 2 h"));
  it("dias", () => expect(relativo("2026-10-01T12:00:00Z", now)).toBe("há 6 dias"));
});
