import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { cellaExcel, creaExcel, nomeFoglio } from "./excel";

describe("excel", () => {
  it("tiene numeri e date come numeri, con il formato giusto", () => {
    expect(cellaExcel(-3.5, "decimale")).toEqual({ t: "n", v: -3.5 });
    expect(cellaExcel("2026-10-27", "data")).toEqual({ t: "n", v: 46322, z: "dd/mm/yyyy" });
    // 06:30 UTC = 07:30 in Italia (ora solare).
    expect(cellaExcel("2026-10-27T06:30:00Z", "data_ora")).toEqual({ t: "n", v: 46322 + 7.5 / 24, z: "dd/mm/yyyy hh:mm" });
    expect(cellaExcel(true, "booleano", "Yes", "No")).toEqual({ t: "s", v: "Yes" });
    expect(cellaExcel(null, "testo")).toBeNull();
  });
  it("scrive i testi come testo, mai come formule", () => {
    expect(cellaExcel("=SOMMA(A1)", "testo")).toEqual({ t: "s", v: "=SOMMA(A1)" });
  });
  it("pulisce il nome del foglio", () => {
    expect(nomeFoglio("a/b:c?[d]")).toBe("a_b_c__d_");
    expect(nomeFoglio("x".repeat(40))).toHaveLength(31);
    expect(nomeFoglio("")).toBe("Dati");
  });
  it("crea un file che Excel sa rileggere", () => {
    const colonne = [
      { nome: "data", originale: "Data", tipo: "data" },
      { nome: "sistolica", originale: "Sistolica", tipo: "intero" },
      { nome: "nota", originale: "Nota", tipo: "testo" },
    ];
    const file = creaExcel("pressione", colonne, [
      { data: "2026-10-27", sistolica: 120, nota: "=1+1" },
      { data: null, sistolica: 118, nota: "dopo cena" },
    ]);
    const libro = XLSX.read(file, { type: "array" });
    expect(libro.SheetNames).toEqual(["pressione"]);
    const foglio = libro.Sheets.pressione;
    expect(foglio["!ref"]).toBe("A1:C3");
    expect(foglio.A1.v).toBe("Data");
    expect(foglio.A2).toMatchObject({ t: "n", v: 46322 });
    expect(foglio.B3).toMatchObject({ t: "n", v: 118 });
    expect(foglio.C2).toMatchObject({ t: "s", v: "=1+1" });
    expect(foglio.C2.f).toBeUndefined();
    expect(foglio.A3).toBeUndefined();
  });
});
