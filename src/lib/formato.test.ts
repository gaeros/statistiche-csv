import { describe, expect, it } from "vitest";
import { cella, riga } from "./csv";
import { cellaExcel } from "./excel";
import { creaFormati } from "./formato";
import { leggiPreferenze } from "./preferenze";

describe("formati scelti dall'utente", () => {
  it("con «automatico» segue la lingua", () => {
    const it_ = creaFormati("it");
    expect(it_.valore("2026-10-27", "data")).toBe("27/10/2026");
    expect(it_.numero(1234.5)).toBe("1234,5");
    expect(it_.numero(12345.5)).toBe("12.345,5");
    const en = creaFormati("en");
    expect(en.valore("2026-10-27", "data")).toBe("27/10/2026");
    expect(en.numero(1234.5)).toBe("1,234.5");
  });
  it("applica il formato della data scelto a date, date e ore e periodi", () => {
    const usa = creaFormati("it", { data: "mm/gg/aaaa", decimali: "auto" });
    expect(usa.valore("2026-10-27", "data")).toBe("10/27/2026");
    expect(usa.dataOra("2026-10-27T06:30:00Z")).toBe("10/27/2026 07:30");
    const iso = creaFormati("en", { data: "aaaa-mm-gg", decimali: "auto" });
    expect(iso.valore("2026-10-27", "data")).toBe("2026-10-27");
    expect(iso.periodo("2026-09-28", "week")).toBe("week of 2026-09-28");
  });
  it("applica il separatore decimale scelto, anche nelle statistiche", () => {
    const punto = creaFormati("it", { data: "auto", decimali: "punto" });
    expect(punto.statistica(3.14159)).toBe("3.14");
    expect(punto.valore(12345.5, "decimale")).toBe("12,345.5");
    expect(punto.localeNumeri).toBe("en-GB");
    const virgola = creaFormati("en", { data: "auto", decimali: "virgola" });
    expect(virgola.percentuale(1, 3)).toBe("33,33%");
    expect(virgola.si).toBe("Yes");
  });
  it("legge le preferenze dai metadati e scarta valori sconosciuti", () => {
    expect(leggiPreferenze({ formati: { data: "aaaa-mm-gg", decimali: "punto" } })).toEqual({ data: "aaaa-mm-gg", decimali: "punto" });
    expect(leggiPreferenze({ formati: { data: "x", decimali: 3 } })).toEqual({ data: "auto", decimali: "auto" });
    expect(leggiPreferenze(undefined)).toEqual({ data: "auto", decimali: "auto" });
  });
  it("nel CSV usa il punto decimale con la virgola come separatore", () => {
    const f = creaFormati("en", { data: "aaaa-mm-gg", decimali: "punto" });
    expect(cella(-3.5, "decimale", f)).toBe("-3.5");
    expect(cella("2026-10-27", "data", f)).toBe("2026-10-27");
    expect(cella("2026-10-27T06:30:00Z", "data_ora", f)).toBe("2026-10-27 07:30");
    expect(cella("Roma, Italia", "testo", f)).toBe('"Roma, Italia"');
    expect(riga(["a", "b"], f.virgola)).toBe("a,b\r\n");
  });
  it("in Excel scrive le date nel formato scelto", () => {
    expect(cellaExcel("2026-10-27", "data", "Sì", "No", "aaaa-mm-gg")?.z).toBe("yyyy-mm-dd");
    expect(cellaExcel("2026-10-27T06:30:00Z", "data_ora", "Sì", "No", "mm/gg/aaaa")?.z).toBe("mm/dd/yyyy hh:mm");
  });
});
