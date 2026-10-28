import { describe, expect, it } from "vitest";
import type { Colonna } from "./filtri";
import { csvPreparato, leggiConfigurazione, prepara, titoloAutomatico } from "./grafici";

const amazon: Colonna[] = [
  { nome: "data_ordine", originale: "Data ordine", tipo: "data" },
  { nome: "categoria", originale: "Categoria", tipo: "testo" },
  { nome: "prezzo", originale: "Prezzo", tipo: "decimale" },
  { nome: "quantita", originale: "Quantità", tipo: "intero" },
];

describe("leggiConfigurazione", () => {
  it("spesa per mese in pochi clic (criterio 10)", () => {
    const c = leggiConfigurazione({ "c.tipo": "barre", "c.x": "data_ordine", "c.per": "month", "c.y": "prezzo", "c.agg": "somma" }, amazon);
    expect(c).toEqual({ tipo: "barre", x: "data_ordine", periodo: "month", y: ["prezzo"], aggregazione: "somma", suddividi: undefined });
    expect(titoloAutomatico(c, amazon)).toBe("Somma di prezzo per mese");
  });

  it("corregge scelte non adatte al tipo di grafico", () => {
    const c = leggiConfigurazione({ "c.tipo": "torta", "c.x": "prezzo", "c.y": ["categoria", "quantita"] }, amazon);
    expect(c.x).toBe("categoria");
    expect(c.y).toEqual(["quantita"]);
    expect(c.aggregazione).toBe("conteggio");
    expect(leggiConfigurazione({ "c.tipo": "dispersione" }, amazon)).toMatchObject({ x: "prezzo", y: ["quantita"] });
  });
});

describe("prepara", () => {
  it("ordina le categorie dal totale più alto e scrive il CSV", () => {
    const c = leggiConfigurazione({ "c.tipo": "barre", "c.x": "categoria", "c.y": "prezzo", "c.agg": "somma" }, amazon);
    const p = prepara(c, { righe: [{ x: "Casa", s: "prezzo", v: 10.5 }, { x: "Libri", s: "prezzo", v: 30 }, { x: null, s: "prezzo", v: 1 }] }, amazon);
    expect(p).toMatchObject({ forma: "serie", categorie: ["Libri", "Casa", "(vuoto)"], serie: [{ nome: "Prezzo", valori: [30, 10.5, 1] }] });
    expect(csvPreparato(p)).toBe("﻿Categoria;Prezzo\r\nLibri;30\r\nCasa;10,5\r\n(vuoto);1\r\n");
  });

  it("le date restano in ordine di tempo, con etichette italiane", () => {
    const c = leggiConfigurazione({ "c.tipo": "linee", "c.x": "data_ordine", "c.agg": "conteggio" }, amazon);
    const p = prepara(c, { righe: [{ x: "2026-01-01", s: "conteggio", v: 1 }, { x: "2026-02-01", s: "conteggio", v: 5 }] }, amazon);
    expect(p).toMatchObject({ categorie: ["gen 2026", "feb 2026"], serie: [{ nome: "Righe", valori: [1, 5] }] });
  });
});
