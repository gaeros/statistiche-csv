import { describe, expect, it } from "vitest";
import { daQuery, leggiSalvati, normalizza, stessiFiltri } from "./filtri-salvati";

describe("normalizza", () => {
  it("tiene solo i filtri, senza vuoti, in ordine", () => {
    expect(
      normalizza({ "f.m.v": ["Sera", "Mattina", "Sera", ""], pagina: "2", "c.tipo": "barre", "f.d.p": "30", "f.n.da": " " }),
    ).toEqual({ "f.d.p": ["30"], "f.m.v": ["Mattina", "Sera"] });
  });

  it("ignora valori che non sono testo", () => {
    expect(normalizza({ "f.x.v": [1, "a", null] as unknown as string[] })).toEqual({ "f.x.v": ["a"] });
  });
});

describe("daQuery", () => {
  it("legge la parte ?... dell'indirizzo", () => {
    expect(daQuery("?f.m.v=Mattina&f.m.v=Sera&ordina=id&f.d.p=30")).toEqual({ "f.d.p": ["30"], "f.m.v": ["Mattina", "Sera"] });
    expect(daQuery("")).toEqual({});
  });
});

describe("stessiFiltri", () => {
  it("non dipende dall'ordine", () => {
    expect(stessiFiltri({ "f.m.v": ["Sera", "Mattina"], "f.d.p": ["30"] }, { "f.d.p": ["30"], "f.m.v": ["Mattina", "Sera"] })).toBe(true);
    expect(stessiFiltri({ "f.d.p": ["30"] }, { "f.d.p": ["7"] })).toBe(false);
    expect(stessiFiltri({}, { "f.d.p": ["7"] })).toBe(false);
  });
});

describe("leggiSalvati", () => {
  it("scarta righe non valide e ripulisce i parametri", () => {
    expect(
      leggiSalvati([
        { id: "1", nome: "Mattina", parametri: { "f.m.v": ["Mattina"], altro: ["x"] } },
        { id: 2, nome: "no" },
        { id: "3", nome: "Vuoto", parametri: null },
      ]),
    ).toEqual([
      { id: "1", nome: "Mattina", parametri: { "f.m.v": ["Mattina"] } },
      { id: "3", nome: "Vuoto", parametri: {} },
    ]);
    expect(leggiSalvati(null)).toEqual([]);
  });
});
