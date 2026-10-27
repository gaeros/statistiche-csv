// Rilevamento e conversione dei tipi di dato (SPEC §4.9).

export type Tipo = "intero" | "decimale" | "testo" | "data" | "data_ora" | "booleano";
export type FormatoNumero = "it" | "en";
export type Valore = string | number | boolean | null;

export const ETICHETTE_TIPO: Record<Tipo, string> = {
  intero: "Intero",
  decimale: "Decimale",
  testo: "Testo",
  data: "Data",
  data_ora: "Data e ora",
  booleano: "Sì/No",
};

const MANCANTI = new Set(["", "na", "n/a", "n.a.", "null", "-", "nd", "n.d.", "nan"]);

export function mancante(v: string): boolean {
  return MANCANTI.has(v.trim().toLowerCase());
}

// ---------------------------------------------------------------------------
// Numeri
// ---------------------------------------------------------------------------

function pulisciNumero(v: string): string {
  return v
    .replace(/[\s  ']/g, "")
    .replace(/^(eur|usd|gbp)|(eur|usd|gbp)$/i, "")
    .replace(/[€$£]/g, "")
    .replace(/^\+/, "");
}

const IT_SOLO = /^-?\d{1,3}(\.\d{3})+(,\d+)?$|^-?\d+,\d+$/; // 1.234,56 · 12,5 · 1.234.567
const EN_SOLO = /^-?\d{1,3}(,\d{3})+(\.\d+)?$|^-?\d+\.\d+$/; // 1,234.56 · 12.5 · 1,234,567
const INTERO_SEMPLICE = /^-?\d+$/;

type FormaNumero = "intero" | "it" | "en" | "ambiguo" | null;

// "1.234" e "1,234" sono ambigui: dipende dal formato della colonna.
function formaNumero(v: string): FormaNumero {
  const s = pulisciNumero(v);
  if (INTERO_SEMPLICE.test(s)) return "intero";
  const it = IT_SOLO.test(s);
  const en = EN_SOLO.test(s);
  if (it && en) return "ambiguo";
  if (it) return "it";
  if (en) return "en";
  return null;
}

export function convertiNumero(v: string, formato: FormatoNumero): number | null {
  let s = pulisciNumero(v);
  if (formato === "it") s = s.replace(/\./g, "").replace(",", ".");
  else s = s.replace(/,/g, "");
  if (!/^-?\d+(\.\d+)?$/.test(s)) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

// ---------------------------------------------------------------------------
// Date
// ---------------------------------------------------------------------------

const DATA_IT = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})(?:[ T,]+(\d{1,2})[:.](\d{2})(?:[:.](\d{2}))?)?$/;
const DATA_ISO =
  /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?\s*(Z|[+-]\d{2}:?\d{2})?)?$/i;

type Parti = { a: number; m: number; g: number; h?: number; min?: number; s?: number; fuso?: string };

function parti(v: string): Parti | null {
  const s = v.trim();
  let r = DATA_ISO.exec(s);
  if (r) {
    return {
      a: +r[1], m: +r[2], g: +r[3],
      h: r[4] !== undefined ? +r[4] : undefined,
      min: r[5] !== undefined ? +r[5] : undefined,
      s: r[6] !== undefined ? +r[6] : undefined,
      fuso: r[7],
    };
  }
  r = DATA_IT.exec(s);
  if (r) {
    return {
      a: +r[3], m: +r[2], g: +r[1],
      h: r[4] !== undefined ? +r[4] : undefined,
      min: r[5] !== undefined ? +r[5] : undefined,
      s: r[6] !== undefined ? +r[6] : undefined,
    };
  }
  return null;
}

function dataReale({ a, m, g, h = 0, min = 0, s = 0 }: Parti): boolean {
  if (a < 1000 || m < 1 || m > 12 || g < 1 || h > 23 || min > 59 || s > 59) return false;
  const d = new Date(Date.UTC(a, m - 1, g));
  return d.getUTCFullYear() === a && d.getUTCMonth() === m - 1 && d.getUTCDate() === g;
}

const due = (n: number) => String(n).padStart(2, "0");

// Differenza tra l'ora di Roma e UTC in un certo istante, in minuti.
function scartoRoma(utcMs: number): number {
  const f = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Rome",
    hourCycle: "h23",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  }).formatToParts(new Date(utcMs));
  const p = Object.fromEntries(f.map((x) => [x.type, x.value]));
  const comeUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
  return Math.round((comeUtc - utcMs) / 60000);
}

function fusoTesto(minuti: number): string {
  const segno = minuti >= 0 ? "+" : "-";
  const a = Math.abs(minuti);
  return `${segno}${due(Math.floor(a / 60))}:${due(a % 60)}`;
}

export function convertiData(v: string): string | null {
  const p = parti(v);
  if (!p || !dataReale(p)) return null;
  return `${p.a}-${due(p.m)}-${due(p.g)}`;
}

// Restituisce un istante ISO con fuso esplicito. Senza fuso nel file vale Europe/Rome.
export function convertiDataOra(v: string): string | null {
  const p = parti(v);
  if (!p || !dataReale(p)) return null;
  const locale = `${p.a}-${due(p.m)}-${due(p.g)}T${due(p.h ?? 0)}:${due(p.min ?? 0)}:${due(p.s ?? 0)}`;
  if (p.fuso) {
    const f = p.fuso.toUpperCase();
    return locale + (f === "Z" ? "Z" : f.includes(":") ? f : `${f.slice(0, 3)}:${f.slice(3)}`);
  }
  const comeUtc = Date.UTC(p.a, p.m - 1, p.g, p.h ?? 0, p.min ?? 0, p.s ?? 0);
  // Due passaggi per gestire bene il cambio dell'ora legale.
  let scarto = scartoRoma(comeUtc);
  scarto = scartoRoma(comeUtc - scarto * 60000);
  return locale + fusoTesto(scarto);
}

function haOra(v: string): boolean {
  const p = parti(v);
  return !!p && p.h !== undefined;
}

// ---------------------------------------------------------------------------
// Booleani
// ---------------------------------------------------------------------------

const VERI = new Set(["si", "sì", "vero", "true", "yes", "s", "y", "x"]);
const FALSI = new Set(["no", "falso", "false", "n"]);
const PAROLE_BOOLEANE = new Set(["si", "sì", "vero", "true", "yes", "no", "falso", "false"]);

export function convertiBooleano(v: string): boolean | null {
  const s = v.trim().toLowerCase();
  if (VERI.has(s) || s === "1") return true;
  if (FALSI.has(s) || s === "0") return false;
  return null;
}

// ---------------------------------------------------------------------------
// Rilevamento del tipo di una colonna
// ---------------------------------------------------------------------------

export type Rilevamento = {
  tipo: Tipo;
  formatoNumero: FormatoNumero;
  valori: number; // non mancanti
  mancanti: number;
  avviso?: string;
};

// I valori arrivano tutti come testo (anche quelli di Excel, normalizzati prima).
export function rilevaTipo(valori: string[], formatoPredefinito: FormatoNumero): Rilevamento {
  const presenti = valori.filter((v) => !mancante(v));
  const mancanti = valori.length - presenti.length;
  const esito = (tipo: Tipo, formatoNumero = formatoPredefinito, avviso?: string): Rilevamento => ({
    tipo, formatoNumero, valori: presenti.length, mancanti, avviso,
  });

  if (presenti.length === 0) return esito("testo", formatoPredefinito, "Colonna vuota");

  // Booleano: solo parole sì/no (una colonna di soli 0/1 resta un numero).
  const minuscoli = presenti.map((v) => v.trim().toLowerCase());
  if (
    minuscoli.every((v) => convertiBooleano(v) !== null) &&
    minuscoli.some((v) => PAROLE_BOOLEANE.has(v))
  ) {
    return esito("booleano");
  }

  // Numeri
  const forme = presenti.map(formaNumero);
  if (forme.every((f) => f !== null)) {
    const conZeri = presenti.some((v) => /^-?0\d/.test(pulisciNumero(v)));
    if (conZeri) return esito("testo", formatoPredefinito, "Numeri con zeri iniziali (es. CAP, codici): importati come testo");
    const it = forme.includes("it");
    const en = forme.includes("en");
    if (it && en) return esito("testo", formatoPredefinito, "Numeri scritti in formati diversi: importati come testo");
    const formato: FormatoNumero = it ? "it" : en ? "en" : formatoPredefinito;
    const numeri = presenti.map((v) => convertiNumero(v, formato));
    if (numeri.every((n) => n !== null)) {
      const interi = numeri.every((n) => Number.isSafeInteger(n));
      return esito(interi ? "intero" : "decimale", formato);
    }
  }

  // Date
  if (presenti.every((v) => convertiData(v) !== null)) {
    return esito(presenti.some(haOra) ? "data_ora" : "data");
  }

  // Quasi tutti dello stesso tipo: si importa come testo, avvisando.
  const numerici = forme.filter((f) => f !== null).length;
  const date = presenti.filter((v) => convertiData(v) !== null).length;
  const quota = Math.max(numerici, date) / presenti.length;
  if (quota >= 0.8) {
    const altri = presenti.length - Math.max(numerici, date);
    return esito(
      "testo",
      formatoPredefinito,
      `${altri} valor${altri === 1 ? "e" : "i"} non ${numerici >= date ? "numeric" + (altri === 1 ? "o" : "i") : "di data"}: colonna importata come testo`,
    );
  }

  return esito("testo");
}

// Converte un valore nel tipo scelto. null = mancante o non convertibile.
export function converti(v: string, tipo: Tipo, formato: FormatoNumero): Valore {
  if (mancante(v)) return null;
  switch (tipo) {
    case "testo":
      return v;
    case "intero": {
      const n = convertiNumero(v, formato);
      return n !== null && Number.isSafeInteger(n) ? n : null;
    }
    case "decimale":
      return convertiNumero(v, formato);
    case "data":
      return convertiData(v);
    case "data_ora":
      return convertiDataOra(v);
    case "booleano":
      return convertiBooleano(v);
  }
}
