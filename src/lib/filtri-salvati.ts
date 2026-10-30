// Filtri salvati (SPEC §6.2): i parametri "f.*" dell'indirizzo, con un nome, per dataset.
// Si salvano così come sono (le scorciatoie di periodo restano relative) e all'apertura
// passano di nuovo da leggiFiltri, che ignora quelli non più validi.

import { soloFiltri, type Parametri } from "./filtri";

export type FiltriSalvati = Record<string, string[]>;
export type FiltroSalvato = { id: string; nome: string; parametri: FiltriSalvati };

export const MAX_NOME = 80;
const MAX_CHIAVI = 100;
const MAX_VALORI = 200;
const MAX_LUNGHEZZA = 200;

// Solo i filtri, senza valori vuoti, in ordine: due combinazioni uguali danno lo stesso oggetto.
export function normalizza(sp: Parametri | Record<string, unknown>): FiltriSalvati {
  const fuori: FiltriSalvati = {};
  const chiavi = Object.keys(soloFiltri(sp as Parametri))
    .filter((k) => k.length <= MAX_LUNGHEZZA)
    .sort()
    .slice(0, MAX_CHIAVI);
  for (const k of chiavi) {
    const v = (sp as Record<string, unknown>)[k];
    const valori = (Array.isArray(v) ? v : [v])
      .filter((x): x is string => typeof x === "string")
      .map((x) => x.trim().slice(0, MAX_LUNGHEZZA))
      .filter((x) => x !== "");
    const unici = [...new Set(valori)].sort().slice(0, MAX_VALORI);
    if (unici.length) fuori[k] = unici;
  }
  return fuori;
}

// Filtri dalla parte "?..." di un indirizzo.
export function daQuery(query: string): FiltriSalvati {
  const sp: Record<string, string[]> = {};
  for (const [k, v] of new URLSearchParams(query.replace(/^\?/, ""))) (sp[k] ??= []).push(v);
  return normalizza(sp);
}

export function stessiFiltri(a: FiltriSalvati, b: FiltriSalvati): boolean {
  return JSON.stringify(normalizza(a)) === JSON.stringify(normalizza(b));
}

// Le righe lette dal database, ricontrollate (parametri sempre nella forma attesa).
export function leggiSalvati(righe: unknown): FiltroSalvato[] {
  if (!Array.isArray(righe)) return [];
  return righe
    .filter((r) => r && typeof r.id === "string" && typeof r.nome === "string")
    .map((r) => ({
      id: r.id,
      nome: r.nome,
      parametri: normalizza(r.parametri && typeof r.parametri === "object" ? r.parametri : {}),
    }));
}
