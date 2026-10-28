// Filtri della dashboard (SPEC §6.2): letti dall'indirizzo della pagina e passati al database.
//
// Parametri nell'indirizzo, per colonna "x":
//   f.x.p      scorciatoia di periodo (7, 30, 90, anno, anno_scorso)   date
//   f.x.da     da (data o numero)          f.x.a     a (data o numero)
//   f.x.v      valori scelti, ripetuto     categorie e Sì/No
//   f.x.t      testo contenuto             testo
//   f.x.dalle  f.x.alle  fascia oraria     data e ora
//   f.x.g      giorni della settimana, ripetuto (1 = lunedì)

import type { Traduttore } from "@/i18n/lingue";
import { creaFormati, type Formati } from "./formato";

export type Colonna = { nome: string; originale: string; tipo: string };

export type Filtro =
  | { colonna: string; tipo: "intervallo"; da?: string; a?: string }
  | { colonna: string; tipo: "valori"; valori: string[] }
  | { colonna: string; tipo: "testo"; testo: string }
  | { colonna: string; tipo: "ore"; da: number; a: number }
  | { colonna: string; tipo: "giorni"; valori: number[] };

export type Parametri = Record<string, string | string[] | undefined>;

export type Etichetta = { testo: string; chiavi: string[] };

// Etichette nei messaggi (gruppo "filtri"): scorciatoia_<chiave> e giorno_1…giorno_7 (1 = lunedì).
export const SCORCIATOIE = ["7", "30", "90", "anno", "anno_scorso"] as const;
export type Scorciatoia = (typeof SCORCIATOIE)[number];

export const GIORNI = [1, 2, 3, 4, 5, 6, 7];

const NUMERICI = ["intero", "decimale"];
const DATE = ["data", "data_ora"];

export const chiave = (colonna: string, campo: string) => `f.${colonna}.${campo}`;

function uno(sp: Parametri, k: string): string | undefined {
  const v = sp[k];
  const s = Array.isArray(v) ? v[0] : v;
  return s === undefined || s.trim() === "" ? undefined : s.trim();
}

function tutti(sp: Parametri, k: string): string[] {
  const v = sp[k];
  return (Array.isArray(v) ? v : v === undefined ? [] : [v]).filter((x) => x !== "");
}

// Oggi a Roma, come "AAAA-MM-GG".
export function oggiRoma(adesso = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome", year: "numeric", month: "2-digit", day: "2-digit" }).format(adesso);
}

function menoGiorni(iso: string, giorni: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - giorni);
  return d.toISOString().slice(0, 10);
}

export function intervalloScorciatoia(s: Scorciatoia, oggi: string): { da: string; a: string } {
  const anno = Number(oggi.slice(0, 4));
  switch (s) {
    case "anno":
      return { da: `${anno}-01-01`, a: oggi };
    case "anno_scorso":
      return { da: `${anno - 1}-01-01`, a: `${anno - 1}-12-31` };
    default:
      return { da: menoGiorni(oggi, Number(s) - 1), a: oggi };
  }
}

const dataValida = (s: string | undefined) => (s && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s)) ? s : undefined);
const numeroValido = (s: string | undefined) => {
  if (s === undefined) return undefined;
  const n = Number(s.replace(",", "."));
  return Number.isFinite(n) ? String(n) : undefined;
};

function daA(t: Traduttore, da: string | undefined, a: string | undefined, fmt: (s: string) => string): string {
  if (da && a) return t("daA", { da: fmt(da), a: fmt(a) });
  if (da) return t("daInSu", { da: fmt(da) });
  return t("finoA", { a: fmt(a!) });
}

// Legge i filtri validi dall'indirizzo; quelli non validi o su colonne inesistenti vengono ignorati.
// `t` è il traduttore del gruppo "filtri", `f` i formati della lingua: servono alle etichette.
// Senza, le etichette non sono tradotte (va bene quando serve solo `filtri`).
export function leggiFiltri(
  sp: Parametri,
  colonne: Colonna[],
  ctx?: { t: Traduttore; f: Formati },
  oggi = oggiRoma(),
): { filtri: Filtro[]; etichette: Etichetta[] } {
  const { t, f } = ctx ?? { t: (k: string) => k, f: creaFormati("it") };
  const filtri: Filtro[] = [];
  const etichette: Etichetta[] = [];

  for (const c of colonne) {
    const k = (campo: string) => chiave(c.nome, campo);

    if (DATE.includes(c.tipo)) {
      const s = uno(sp, k("p"));
      if (s && (SCORCIATOIE as readonly string[]).includes(s)) {
        filtri.push({ colonna: c.nome, tipo: "intervallo", ...intervalloScorciatoia(s as Scorciatoia, oggi) });
        etichette.push({ testo: `${c.originale}: ${t(`scorciatoia_${s}`)}`, chiavi: [k("p"), k("da"), k("a")] });
      } else {
        const da = dataValida(uno(sp, k("da")));
        const a = dataValida(uno(sp, k("a")));
        if (da || a) {
          filtri.push({ colonna: c.nome, tipo: "intervallo", da, a });
          etichette.push({ testo: `${c.originale}: ${daA(t, da, a, (x) => f.valore(x, "data"))}`, chiavi: [k("p"), k("da"), k("a")] });
        }
      }

      const giorni = [...new Set(tutti(sp, k("g")).map(Number).filter((n) => Number.isInteger(n) && n >= 1 && n <= 7))].sort();
      if (giorni.length > 0 && giorni.length < 7) {
        filtri.push({ colonna: c.nome, tipo: "giorni", valori: giorni });
        etichette.push({ testo: `${c.originale}: ${giorni.map((g) => t(`giorno_${g}`)).join(", ")}`, chiavi: [k("g")] });
      }

      if (c.tipo === "data_ora") {
        const dalle = Number(uno(sp, k("dalle")));
        const alle = Number(uno(sp, k("alle")));
        const ok = (n: number) => Number.isInteger(n) && n >= 0 && n <= 24;
        if (uno(sp, k("dalle")) && uno(sp, k("alle")) && ok(dalle) && ok(alle) && dalle !== alle) {
          filtri.push({ colonna: c.nome, tipo: "ore", da: dalle, a: alle });
          etichette.push({ testo: `${c.originale}: ${t("dalleAlle", { da: dalle, a: alle })}`, chiavi: [k("dalle"), k("alle")] });
        }
      }
    } else if (NUMERICI.includes(c.tipo)) {
      const da = numeroValido(uno(sp, k("da")));
      const a = numeroValido(uno(sp, k("a")));
      if (da !== undefined || a !== undefined) {
        filtri.push({ colonna: c.nome, tipo: "intervallo", da, a });
        etichette.push({ testo: `${c.originale}: ${daA(t, da, a, (x) => f.numero(Number(x)))}`, chiavi: [k("da"), k("a")] });
      }
    } else if (c.tipo === "testo" || c.tipo === "booleano") {
      const valori = [...new Set(tutti(sp, k("v")))];
      if (valori.length > 0) {
        filtri.push({ colonna: c.nome, tipo: "valori", valori });
        const testo = c.tipo === "booleano" ? valori.map((v) => (v === "true" ? f.si : f.no)) : valori;
        etichette.push({ testo: `${c.originale}: ${testo.join(", ")}`, chiavi: [k("v")] });
      }
      const cerca = uno(sp, k("t"));
      if (c.tipo === "testo" && cerca) {
        filtri.push({ colonna: c.nome, tipo: "testo", testo: cerca.slice(0, 200) });
        etichette.push({ testo: t("contiene", { colonna: c.originale, testo: cerca.slice(0, 200) }), chiavi: [k("t")] });
      }
    }
  }

  return { filtri, etichette };
}

// Indirizzo con alcuni parametri cambiati (null = tolto), mantenendo gli altri.
export function conParametri(sp: Parametri, modifiche: Record<string, string | string[] | null>, ancora = ""): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) {
    if (k in modifiche) continue;
    for (const x of Array.isArray(v) ? v : v === undefined ? [] : [v]) q.append(k, x);
  }
  for (const [k, v] of Object.entries(modifiche)) {
    if (v === null) continue;
    for (const x of Array.isArray(v) ? v : [v]) q.append(k, x);
  }
  const s = q.toString();
  return `${s ? `?${s}` : "?"}${ancora}`;
}

export const senzaFiltri = (sp: Parametri): Parametri =>
  Object.fromEntries(Object.entries(sp).filter(([k]) => !k.startsWith("f.")));

export const soloFiltri = (sp: Parametri): Parametri =>
  Object.fromEntries(Object.entries(sp).filter(([k]) => k.startsWith("f.")));
