import { describe, expect, it } from "vitest";
import { creaAnteprima, nonConformi, preparaRighe, riepilogo, type Anteprima } from "./anteprima";
import type { Foglio } from "./lettura";

// Pressione con qualche errore di battitura: "12O" (lettera O), "n.d." (mancante), "ottanta".
const foglio: Foglio = {
  nome: null,
  formatoNumero: "it",
  righe: [
    ["Data", "Sistolica", "Battiti"],
    ["24/09/2026", "128", "89"],
    ["", "", ""],
    ["25/09/2026", "12O", "90"],
    ["31/09/2026", "120", "ottanta"],
    ["26/09/2026", "12O", "n.d."],
    ["27/09/2026", "121", "87"],
  ],
};

function anteprima(): Anteprima {
  const a = creaAnteprima(foglio, "pressione.csv");
  // Il rilevamento propone testo per le colonne sporche: l'utente sceglie il tipo giusto.
  a.colonne = a.colonne.map((c) => ({ ...c, tipo: c.nome === "data" ? "data" : "intero" }));
  return a;
}

const colonna = (a: Anteprima, nome: string) => a.colonne.find((c) => c.nome === nome)!;
const conCorrezioni = (a: Anteprima, nome: string, modifica: object): Anteprima => ({
  ...a,
  colonne: a.colonne.map((c) => (c.nome === nome ? { ...c, ...modifica } : c)),
});

describe("anteprima guidata", () => {
  it("numera le righe come nel file, saltando quelle vuote", () => {
    expect(anteprima().numeriRiga).toEqual([2, 4, 5, 6, 7]);
  });

  it("raggruppa i valori non validi per il tipo scelto", () => {
    const a = anteprima();
    expect(nonConformi(a, colonna(a, "sistolica"))).toEqual([{ valore: "12O", righe: [1, 3] }]);
    expect(nonConformi(a, colonna(a, "battiti"))).toEqual([{ valore: "ottanta", righe: [2] }]);
    expect(nonConformi(a, colonna(a, "data"))).toEqual([{ valore: "31/09/2026", righe: [2] }]);
    expect(riepilogo(a)).toEqual({ righe: 5, escluse: 0, vuoti: 4, corretti: 0 });
  });

  it("applica le correzioni a tutte le occorrenze di un valore", () => {
    const a = conCorrezioni(anteprima(), "sistolica", { correzioni: { "12O": "120" } });
    expect(nonConformi(a, colonna(a, "sistolica"))).toEqual([]);
    // L'elenco da mostrare resta quello del file, anche dopo la correzione.
    expect(nonConformi(a, colonna(a, "sistolica"), true)).toHaveLength(1);
    const { righe, corretti, nonConvertiti } = preparaRighe(a);
    expect(righe.map((r) => r.sistolica)).toEqual([128, 120, 120, 120, 121]);
    expect(corretti).toEqual({ sistolica: 2 });
    expect(nonConvertiti).toEqual({ data: 1, battiti: 1 });
    expect(riepilogo(a)).toEqual({ righe: 5, escluse: 0, vuoti: 2, corretti: 2 });
  });

  it("una correzione sbagliata resta da controllare", () => {
    const a = conCorrezioni(anteprima(), "battiti", { correzioni: { ottanta: "ottanta!" } });
    expect(nonConformi(a, colonna(a, "battiti"))).toEqual([{ valore: "ottanta", righe: [2] }]);
  });

  it("può escludere le righe con valori non validi", () => {
    const a = conCorrezioni(anteprima(), "data", { seNonConforme: "escludi" });
    const { righe, escluse, nonConvertiti } = preparaRighe(a);
    expect(escluse).toBe(1);
    expect(righe).toHaveLength(4);
    // "ottanta" stava nella riga esclusa: non conta più fra i vuoti.
    expect(nonConvertiti).toEqual({ sistolica: 2 });
    expect(riepilogo(a)).toEqual({ righe: 4, escluse: 1, vuoti: 2, corretti: 0 });
  });

  it("le correzioni non valgono per le colonne di testo", () => {
    const a = conCorrezioni(anteprima(), "sistolica", { tipo: "testo", correzioni: { "12O": "120" } });
    expect(preparaRighe(a).righe[1].sistolica).toBe("12O");
    expect(nonConformi(a, colonna(a, "sistolica"))).toEqual([]);
  });

  it("il formato dei numeri si può cambiare", () => {
    const a = creaAnteprima({ nome: null, formatoNumero: "it", righe: [["Peso"], ["70.5"], ["71.25"]] }, "p.csv");
    expect(colonna(a, "peso")).toMatchObject({ tipo: "decimale", formatoNumero: "en" });
    const it = conCorrezioni(a, "peso", { formatoNumero: "it" });
    expect(nonConformi(it, colonna(it, "peso"))).toHaveLength(2);
  });
});

describe("tipo proposto", () => {
  it("una colonna quasi tutta numerica resta testo ma propone il numero", () => {
    const a = creaAnteprima(foglio, "pressione.csv");
    expect(colonna(a, "data")).toMatchObject({ tipo: "testo", tipoSuggerito: "data" });
    // 2 valori su 5 non numerici: troppi per proporre il numero.
    expect(colonna(a, "sistolica").tipoSuggerito).toBeUndefined();
    const b = creaAnteprima(
      { nome: null, formatoNumero: "it", righe: [["Peso"], ["70,5"], ["71"], ["7l"], ["72,25"], ["69"]] },
      "p.csv",
    );
    expect(colonna(b, "peso")).toMatchObject({ tipo: "testo", tipoSuggerito: "decimale", formatoNumero: "it" });
  });
});
