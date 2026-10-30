import { describe, expect, it } from "vitest";
import { codiceValido, dataScadenza, leggiScadenza, percorsoCondiviso, scaduto } from "./condivisioni";

describe("scadenza", () => {
  const adesso = new Date("2026-10-30T10:00:00Z");

  it("propone 30 giorni se la scelta non è valida", () => {
    expect(leggiScadenza("7")).toBe("7");
    expect(leggiScadenza("mai")).toBe("mai");
    expect(leggiScadenza("1000")).toBe("30");
    expect(leggiScadenza(null)).toBe("30");
  });

  it("calcola la data o nessuna data", () => {
    expect(dataScadenza("7", adesso)).toBe("2026-11-06T10:00:00.000Z");
    expect(dataScadenza("mai", adesso)).toBeNull();
  });

  it("riconosce un link scaduto", () => {
    expect(scaduto(null, adesso)).toBe(false);
    expect(scaduto("2026-10-30T09:59:59Z", adesso)).toBe(true);
    expect(scaduto("2026-10-31T00:00:00Z", adesso)).toBe(false);
  });
});

describe("codice del link", () => {
  it("accetta solo 64 caratteri esadecimali", () => {
    expect(codiceValido("a".repeat(64))).toBe(true);
    expect(codiceValido("a".repeat(63))).toBe(false);
    expect(codiceValido("A".repeat(64))).toBe(false);
    expect(codiceValido("../" + "a".repeat(61))).toBe(false);
  });

  it("forma il percorso della pagina pubblica", () => {
    expect(percorsoCondiviso("ab")).toBe("/condiviso/ab");
  });
});
