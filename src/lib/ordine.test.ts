import { describe, expect, it } from "vitest";
import { applicaOrdine, sposta, stessoOrdine } from "./ordine";

describe("applicaOrdine", () => {
  const colonne = ["data", "momento", "sistolica", "diastolica"];

  it("senza ordine salvato tiene l'ordine del file", () => {
    expect(applicaOrdine(colonne, [])).toEqual(colonne);
  });

  it("mette prima le colonne salvate, poi le altre nell'ordine del file", () => {
    expect(applicaOrdine(colonne, ["sistolica", "data"])).toEqual(["sistolica", "data", "momento", "diastolica"]);
  });

  it("ignora colonne sparite e doppioni", () => {
    expect(applicaOrdine(colonne, ["battiti", "diastolica", "diastolica"])).toEqual([
      "diastolica",
      "data",
      "momento",
      "sistolica",
    ]);
  });
});

describe("sposta", () => {
  it("sposta avanti e indietro", () => {
    expect(sposta(["a", "b", "c", "d"], 0, 2)).toEqual(["b", "c", "a", "d"]);
    expect(sposta(["a", "b", "c", "d"], 3, 0)).toEqual(["d", "a", "b", "c"]);
  });

  it("resta nei limiti", () => {
    expect(sposta(["a", "b"], 0, 9)).toEqual(["b", "a"]);
    expect(sposta(["a", "b"], 5, 0)).toEqual(["a", "b"]);
  });
});

it("stessoOrdine", () => {
  expect(stessoOrdine(["a", "b"], ["a", "b"])).toBe(true);
  expect(stessoOrdine(["a", "b"], ["b", "a"])).toBe(false);
});
