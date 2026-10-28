import { describe, expect, it } from "vitest";
import { formatiIt, traduttore } from "@/test/traduttore";
import { conParametri, intervalloScorciatoia, leggiFiltri, oggiRoma, type Colonna } from "./filtri";

const ctx = { t: traduttore("filtri"), f: formatiIt };

const colonne: Colonna[] = [
  { nome: "data", originale: "Data", tipo: "data" },
  { nome: "misurata", originale: "Misurata", tipo: "data_ora" },
  { nome: "momento", originale: "Momento", tipo: "testo" },
  { nome: "sistolica", originale: "Sistolica", tipo: "intero" },
  { nome: "a_digiuno", originale: "A digiuno", tipo: "booleano" },
];

describe("leggiFiltri", () => {
  it("legge scorciatoia di periodo e categorie (criterio 9)", () => {
    const { filtri, etichette } = leggiFiltri({ "f.data.p": "30", "f.momento.v": "Mattina" }, colonne, ctx, "2026-10-28");
    expect(filtri).toEqual([
      { colonna: "data", tipo: "intervallo", da: "2026-09-29", a: "2026-10-28" },
      { colonna: "momento", tipo: "valori", valori: ["Mattina"] },
    ]);
    expect(etichette.map((e) => e.testo)).toEqual(["Data: ultimi 30 giorni", "Momento: Mattina"]);
  });

  it("legge intervalli numerici con la virgola e ignora i valori non validi", () => {
    const { filtri, etichette } = leggiFiltri(
      { "f.sistolica.da": "100,5", "f.sistolica.a": "abc", "f.data.da": "2026-13-45", "f.ignota.v": "x" },
      colonne,
      ctx,
      "2026-10-28",
    );
    expect(filtri).toEqual([{ colonna: "sistolica", tipo: "intervallo", da: "100.5", a: undefined }]);
    expect(etichette[0].testo).toBe("Sistolica: da 100,5 in su");
  });

  it("legge fascia oraria, giorni e Sì/No", () => {
    const { filtri, etichette } = leggiFiltri(
      { "f.misurata.dalle": "6", "f.misurata.alle": "12", "f.misurata.g": ["1", "3"], "f.a_digiuno.v": "true" },
      colonne,
      ctx,
    );
    expect(filtri).toContainEqual({ colonna: "misurata", tipo: "ore", da: 6, a: 12 });
    expect(filtri).toContainEqual({ colonna: "misurata", tipo: "giorni", valori: [1, 3] });
    expect(etichette.map((e) => e.testo)).toContain("A digiuno: Sì");
    expect(etichette.map((e) => e.testo)).toContain("Misurata: lun, mer");
  });

  it("ignora i campi vuoti del modulo", () => {
    expect(leggiFiltri({ "f.sistolica.da": "", "f.momento.t": " ", "f.data.p": "" }, colonne).filtri).toEqual([]);
  });
});

describe("date", () => {
  it("calcola le scorciatoie", () => {
    expect(intervalloScorciatoia("7", "2026-03-02")).toEqual({ da: "2026-02-24", a: "2026-03-02" });
    expect(intervalloScorciatoia("anno_scorso", "2026-10-28")).toEqual({ da: "2025-01-01", a: "2025-12-31" });
  });
  it("oggi è nel giorno di Roma", () => {
    expect(oggiRoma(new Date("2026-10-27T23:30:00Z"))).toBe("2026-10-28");
  });
});

describe("conParametri", () => {
  it("cambia e toglie parametri mantenendo gli altri", () => {
    expect(conParametri({ a: "1", "f.x.v": ["p", "q"], b: "2" }, { "f.x.v": null, b: "3" }, "#s")).toBe("?a=1&b=3#s");
  });
});
