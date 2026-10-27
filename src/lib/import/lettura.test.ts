import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { creaAnteprima, preparaRighe } from "./anteprima";
import { decodifica, leggiCsv, leggiExcel, leggiFile } from "./lettura";

// Codifica Windows-1252 dei caratteri usati nei test.
function cp1252(testo: string): Uint8Array<ArrayBuffer> {
  const mappa: Record<string, number> = { "à": 0xe0, "€": 0x80, "è": 0xe8 };
  return Uint8Array.from([...testo].map((c) => mappa[c] ?? c.charCodeAt(0)));
}

describe("lettura CSV (SPEC §4.3)", () => {
  it("criterio 1: Vendite Q1 2024.csv in Windows-1252 con ;", async () => {
    const byte = cp1252(
      "Data;Regione;Quantità;Prezzo (€)\r\n15/01/2024;Lazio;3;1.234,56\r\n01/02/2024;Puglia;1;9,90\r\n\r\n",
    );
    const letto = await leggiFile(new File([byte], "Vendite Q1 2024.csv"));
    expect(letto).toMatchObject({ encoding: "windows-1252", separatore: ";" });

    const a = creaAnteprima(letto.fogli[0], "Vendite Q1 2024.csv");
    expect(a.nomeTabella).toBe("vendite_q1_2024");
    expect(a.colonne.map((c) => [c.nome, c.tipo])).toEqual([
      ["data", "data"],
      ["regione", "testo"],
      ["quantita", "intero"],
      ["prezzo_eur", "decimale"],
    ]);
    expect(a.colonne[2].originale).toBe("Quantità");

    const { righe, nonConvertiti } = preparaRighe(a);
    expect(righe).toEqual([
      { data: "2024-01-15", regione: "Lazio", quantita: 3, prezzo_eur: 1234.56 },
      { data: "2024-02-01", regione: "Puglia", quantita: 1, prezzo_eur: 9.9 },
    ]);
    expect(nonConvertiti).toEqual({});
  });

  it("criterio 3: due colonne Totale diventano totale e totale_2", () => {
    const { righe } = leggiCsv("Totale,Totale\n1,2\n");
    const a = creaAnteprima({ nome: null, righe, formatoNumero: "en" }, "x.csv");
    expect(a.colonne.map((c) => c.nome)).toEqual(["totale", "totale_2"]);
  });

  it("gestisce virgolette e a capo nei campi (RFC 4180)", () => {
    const { righe, separatore } = leggiCsv('nome,nota\n"Rossi, Mario","riga 1\nriga 2"\n');
    expect(separatore).toBe(",");
    expect(righe[1]).toEqual(["Rossi, Mario", "riga 1\nriga 2"]);
  });

  it("riconosce UTF-8 con BOM e toglie il BOM", () => {
    const byte = new Uint8Array([0xef, 0xbb, 0xbf, ...new TextEncoder().encode("Città\n")]);
    expect(decodifica(byte)).toEqual({ testo: "Città\n", encoding: "utf-8" });
  });

  it("segnala un'intestazione che sembra fatta di dati", () => {
    const { righe } = leggiCsv("1;2;3\n4;5;6\n");
    const a = creaAnteprima({ nome: null, righe, formatoNumero: "it" }, "numeri.csv");
    expect(a.intestazioneSospetta).toBe(true);
    const b = creaAnteprima({ nome: null, righe, formatoNumero: "it" }, "numeri.csv", { senzaIntestazione: true });
    expect(b.colonne.map((c) => c.nome)).toEqual(["colonna_1", "colonna_2", "colonna_3"]);
    expect(b.righe).toHaveLength(2);
  });

  it("permette l'intestazione su un'altra riga", () => {
    const { righe } = leggiCsv("Report vendite;;\n;;\nProdotto;Pezzi;Prezzo\nA;1;2,5\n");
    const a = creaAnteprima({ nome: null, righe, formatoNumero: "it" }, "r.csv", { rigaIntestazione: 3 });
    expect(a.colonne.map((c) => c.nome)).toEqual(["prodotto", "pezzi", "prezzo"]);
    expect(a.righe).toEqual([["A", "1", "2,5"]]);
  });

  it("rifiuta formati non supportati e file vuoti", async () => {
    await expect(leggiFile(new File(["x"], "foto.png"))).rejects.toThrow("Formato non supportato");
    await expect(leggiFile(new File([], "vuoto.csv"))).rejects.toThrow("vuoto");
  });
});

describe("lettura Excel (SPEC §4.4)", () => {
  function creaXlsx(): ArrayBuffer {
    const libro = XLSX.utils.book_new();
    const conData = XLSX.utils.aoa_to_sheet([["Data", "Importo"], [new Date(Date.UTC(2024, 0, 15)), 12.5]], { cellDates: false });
    XLSX.utils.book_append_sheet(libro, conData, "Gennaio");
    XLSX.utils.book_append_sheet(libro, XLSX.utils.aoa_to_sheet([["A"], [1]]), "Febbraio");
    XLSX.utils.book_append_sheet(libro, XLSX.utils.aoa_to_sheet([["B"], ["x"]]), "Note");
    return XLSX.write(libro, { type: "array", bookType: "xlsx" });
  }

  it("criterio 2: legge tutti i fogli, ognuno con il proprio nome tabella", () => {
    const fogli = leggiExcel(creaXlsx());
    expect(fogli.map((f) => f.nome)).toEqual(["Gennaio", "Febbraio", "Note"]);
    const a = creaAnteprima(fogli[0], "Spese 2024.xlsx");
    expect(a.nomeTabella).toBe("spese_2024_gennaio");
    expect(a.colonne.map((c) => [c.nome, c.tipo])).toEqual([
      ["data", "data"],
      ["importo", "decimale"],
    ]);
    expect(preparaRighe(a).righe).toEqual([{ data: "2024-01-15", importo: 12.5 }]);
  });
});

const PRESSIONE = "/mnt/project-files/spec/esempi/pressione-2026-10-27.csv";

describe.skipIf(!existsSync(PRESSIONE))("file reale della pressione (SPEC §14)", () => {
  it("dà le colonne e i tipi attesi", async () => {
    const letto = await leggiFile(new File([new Uint8Array(readFileSync(PRESSIONE))], "pressione-2026-10-27.csv"));
    const a = creaAnteprima(letto.fogli[0], "pressione-2026-10-27.csv");
    expect(a.nomeTabella).toBe("pressione_2026_10_27");
    expect(a.colonne.map((c) => [c.nome, c.tipo, c.includi])).toEqual([
      ["data", "data", true],
      ["momento", "testo", true],
      ["sistolica", "intero", true],
      ["diastolica", "intero", true],
      ["battiti", "intero", true],
      ["contesto", "testo", true],
      ["nota", "testo", false],
    ]);
    expect(a.righe).toHaveLength(38);
  });
});
