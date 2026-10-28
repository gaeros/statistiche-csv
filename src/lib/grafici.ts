// Costruttore di grafici (SPEC §6.1): configurazione di un grafico e preparazione dei dati da disegnare.
import type { Colonna, Parametri } from "./filtri";
import { BOM, cellaNumero, cellaTesto, riga } from "./csv";
import type { Traduttore } from "@/i18n/lingue";
import type { Formati } from "./formato";

// Le etichette si trovano nei messaggi (gruppo "grafici"): tipo_<chiave>, agg_<chiave>, per_<chiave>.
export const TIPI = ["barre", "barre_impilate", "linee", "area", "torta", "dispersione", "istogramma", "box"] as const;
export type TipoGrafico = (typeof TIPI)[number];

export const AGGREGAZIONI = ["conteggio", "somma", "media", "mediana", "minimo", "massimo"] as const;
export type Aggregazione = (typeof AGGREGAZIONI)[number];

export const PERIODI = ["day", "week", "month", "year"] as const;
export type Periodo = (typeof PERIODI)[number];

export type Configurazione = {
  tipo: TipoGrafico;
  x?: string;
  periodo?: Periodo;
  y: string[];
  aggregazione: Aggregazione;
  suddividi?: string;
};

// Dati pronti da disegnare (etichette già nella lingua dell'utente)
export type Preparato =
  | { forma: "serie"; tipo: "barre" | "barre_impilate" | "linee" | "area"; categorie: string[]; serie: { nome: string; valori: (number | null)[] }[]; asseX: string; asseY: string }
  | { forma: "torta"; fette: { nome: string; valore: number }[]; asseY: string }
  | { forma: "dispersione"; punti: [number, number][]; asseX: string; asseY: string }
  | { forma: "istogramma"; categorie: string[]; valori: number[]; asseY: string }
  | { forma: "box"; categorie: string[]; scatole: [number, number, number, number, number][]; asseY: string };

const NUMERICI = ["intero", "decimale"];
const DATE = ["data", "data_ora"];
const CATEGORIE = ["testo", "booleano"];

export function colonneAdatte(tipo: TipoGrafico, colonne: Colonna[]) {
  const numeri = colonne.filter((c) => NUMERICI.includes(c.tipo));
  const categorie = colonne.filter((c) => CATEGORIE.includes(c.tipo));
  const date = colonne.filter((c) => DATE.includes(c.tipo));
  switch (tipo) {
    case "dispersione":
      return { x: numeri, y: numeri, suddividi: [] };
    case "istogramma":
      return { x: [], y: numeri, suddividi: [] };
    case "box":
      return { x: [...categorie, ...date], y: numeri, suddividi: [] };
    case "torta":
      return { x: categorie, y: numeri, suddividi: [] };
    default:
      return { x: [...date, ...categorie], y: numeri, suddividi: categorie };
  }
}

function uno(sp: Parametri, k: string): string | undefined {
  const v = sp[k];
  const s = Array.isArray(v) ? v[0] : v;
  return s ? s : undefined;
}

// Legge la configurazione dai parametri "c.*" dell'indirizzo, correggendo le scelte non adatte.
export function leggiConfigurazione(sp: Parametri, colonne: Colonna[]): Configurazione {
  const tipo = (uno(sp, "c.tipo") ?? "barre") as TipoGrafico;
  const t: TipoGrafico = TIPI.includes(tipo) ? tipo : "barre";
  const adatte = colonneAdatte(t, colonne);
  const nomi = (l: Colonna[]) => l.map((c) => c.nome);

  // Per istogramma e box plot la colonna X è facoltativa
  let x = uno(sp, "c.x");
  if (x && !nomi(adatte.x).includes(x)) x = undefined;
  if (!x && t !== "istogramma" && t !== "box") x = adatte.x[0]?.nome;

  const yv = sp["c.y"];
  let y = (Array.isArray(yv) ? yv : yv ? [yv] : []).filter((v) => nomi(adatte.y).includes(v));
  const unaSola = ["dispersione", "istogramma", "box", "torta"].includes(t);
  if (t === "dispersione") y = y.filter((v) => v !== x);
  if (y.length === 0 && adatte.y.length) y = [adatte.y.find((c) => c.nome !== x)?.nome ?? adatte.y[0].nome];
  if (unaSola) y = y.slice(0, 1);
  y = y.slice(0, 8);

  const agg = uno(sp, "c.agg") as Aggregazione | undefined;
  let aggregazione: Aggregazione = agg && AGGREGAZIONI.includes(agg) ? agg : adatte.y.length ? "media" : "conteggio";
  if (!adatte.y.length) aggregazione = "conteggio";
  if (t === "torta" && !agg) aggregazione = "conteggio";
  // Impilare medie o massimi non ha senso: le barre impilate sommano
  if (t === "barre_impilate" && aggregazione !== "somma") aggregazione = "conteggio";

  const per = uno(sp, "c.per") as Periodo | undefined;
  const periodo: Periodo = per && PERIODI.includes(per) ? per : "month";

  let suddividi = uno(sp, "c.sudd");
  if (!suddividi || !nomi(adatte.suddividi).includes(suddividi) || suddividi === x) suddividi = undefined;
  if (t === "barre_impilate" && !suddividi) suddividi = adatte.suddividi.find((c) => c.nome !== x)?.nome;

  return { tipo: t, x, periodo, y: aggregazione === "conteggio" && !unaSola ? [] : y, aggregazione, suddividi };
}

// Parametri dell'indirizzo che riproducono una configurazione (per aprire un grafico salvato nel costruttore).
export function parametriConfigurazione(c: Configurazione): Record<string, string | string[]> {
  return {
    "c.tipo": c.tipo,
    ...(c.x ? { "c.x": c.x } : {}),
    ...(c.periodo ? { "c.per": c.periodo } : {}),
    "c.y": c.y,
    "c.agg": c.aggregazione,
    ...(c.suddividi ? { "c.sudd": c.suddividi } : {}),
  };
}

export function titoloAutomatico(c: Configurazione, colonne: Colonna[], t: Traduttore): string {
  const nome = (n?: string) => colonne.find((x) => x.nome === n)?.originale ?? n ?? "";
  const valori = c.y.map(nome).join(", ");
  switch (c.tipo) {
    case "dispersione":
      return t("titoloDispersione", { y: nome(c.y[0]), x: nome(c.x) });
    case "istogramma":
      return t("titoloIstogramma", { valori });
    case "box":
      return c.x ? t("titoloPer", { misura: valori, per: nome(c.x).toLowerCase() }) : valori;
  }
  const misura = c.aggregazione === "conteggio" ? t("righe") : t("misuraDi", { agg: t(`agg_${c.aggregazione}`), valori: valori.toLowerCase() });
  const dataX = colonne.find((x) => x.nome === c.x && DATE.includes(x.tipo));
  const per = dataX ? t(`per_${c.periodo ?? "month"}`) : nome(c.x).toLowerCase();
  return c.suddividi
    ? t("titoloPerE", { misura, per, sudd: nome(c.suddividi).toLowerCase() })
    : t("titoloPer", { misura, per });
}

type Risultato = {
  righe?: { x: string | null; s: string; v: number | string | null }[];
  punti?: [number, number][];
  barre?: { da: number; a: number; conteggio: number }[];
  scatole?: { x: string | null; minimo: number; q1: number; mediana: number; q3: number; massimo: number; n: number }[];
};

export function prepara(c: Configurazione, r: Risultato, colonne: Colonna[], f: Formati, t: Traduttore): Preparato {
  const col = (n?: string) => colonne.find((x) => x.nome === n);
  const nome = (n?: string) => col(n)?.originale ?? n ?? "";
  const tipoX = col(c.x)?.tipo;
  const etichettaX = (v: string | null) => {
    if (v === null) return t("vuoto");
    if (tipoX && DATE.includes(tipoX)) return f.periodo(v, c.periodo ?? "month");
    if (tipoX === "booleano") return v === "true" ? f.si : f.no;
    return v;
  };
  const etichettaS = (s: string) =>
    c.suddividi ? (col(c.suddividi)?.tipo === "booleano" ? (s === "true" ? f.si : s === "false" ? f.no : s) : s ?? t("vuoto")) : s === "conteggio" ? t("righe") : nome(s);
  const asseY =
    c.aggregazione === "conteggio"
      ? t("righe")
      : c.y.length === 1
        ? t("misuraDi", { agg: t(`agg_${c.aggregazione}`), valori: nome(c.y[0]) })
        : t(`agg_${c.aggregazione}`);

  if (c.tipo === "dispersione") {
    return { forma: "dispersione", punti: (r.punti ?? []).map(([a, b]) => [Number(a), Number(b)]), asseX: nome(c.x), asseY: nome(c.y[0]) };
  }
  if (c.tipo === "istogramma") {
    const intero = col(c.y[0])?.tipo === "intero";
    const fmt = (n: number) => f.valore(Math.round(n * 100) / 100, "decimale");
    return {
      forma: "istogramma",
      categorie: (r.barre ?? []).map((b) => (b.da === b.a ? fmt(b.da) : `${fmt(intero ? Math.ceil(b.da) : b.da)}–${fmt(b.a)}`)),
      valori: (r.barre ?? []).map((b) => Number(b.conteggio)),
      asseY: t("righePerFascia", { nome: nome(c.y[0]) }),
    };
  }
  if (c.tipo === "box") {
    const sc = r.scatole ?? [];
    return {
      forma: "box",
      categorie: sc.map((s) => (c.x ? etichettaX(s.x) : nome(c.y[0]))),
      scatole: sc.map((s) => [s.minimo, s.q1, s.mediana, s.q3, s.massimo].map(Number) as [number, number, number, number, number]),
      asseY: nome(c.y[0]),
    };
  }

  const righe = r.righe ?? [];
  if (c.tipo === "torta") {
    return {
      forma: "torta",
      fette: righe.filter((x) => x.v !== null).map((x) => ({ nome: etichettaX(x.x), valore: Number(x.v) })).sort((a, b) => b.valore - a.valore),
      asseY,
    };
  }

  // Ordine delle categorie: per le date in ordine di tempo, per le altre dal totale più alto
  const xs = [...new Set(righe.map((x) => x.x))];
  if (!(tipoX && DATE.includes(tipoX))) {
    const totale = new Map<string | null, number>();
    for (const x of righe) totale.set(x.x, (totale.get(x.x) ?? 0) + Math.abs(Number(x.v ?? 0)));
    xs.sort((a, b) => (totale.get(b) ?? 0) - (totale.get(a) ?? 0));
  }
  // Serie nell'ordine scelto dall'utente (il database le restituisce in ordine alfabetico)
  const nomiSerie = [...new Set(righe.map((x) => x.s))].sort((a, b) =>
    c.suddividi ? 0 : c.y.indexOf(a) - c.y.indexOf(b),
  );
  const indice = new Map(righe.map((x) => [`${x.x}\u0000${x.s}`, x.v === null ? null : Number(x.v)]));
  return {
    forma: "serie",
    tipo: c.tipo as "barre" | "barre_impilate" | "linee" | "area",
    categorie: xs.map(etichettaX),
    serie: nomiSerie.map((s) => ({ nome: etichettaS(s), valori: xs.map((x) => indice.get(`${x}\u0000${s}`) ?? null) })),
    asseX: nome(c.x),
    asseY,
  };
}

// Dati del grafico in CSV (separatore ";" e virgola decimale, come vuole Excel in italiano e nei paesi europei)
export function csvPreparato(p: Preparato, t: Traduttore): string {
  const n = cellaNumero;
  const q = cellaTesto;
  let righe: string[][];
  switch (p.forma) {
    case "serie":
      righe = [[q(p.asseX), ...p.serie.map((s) => q(s.nome))], ...p.categorie.map((c, i) => [q(c), ...p.serie.map((s) => n(s.valori[i]))])];
      break;
    case "torta":
      righe = [[t("csvValore"), q(p.asseY)], ...p.fette.map((f) => [q(f.nome), n(f.valore)])];
      break;
    case "dispersione":
      righe = [[q(p.asseX), q(p.asseY)], ...p.punti.map(([a, b]) => [n(a), n(b)])];
      break;
    case "istogramma":
      righe = [[t("csvFascia"), t("righe")], ...p.categorie.map((c, i) => [q(c), n(p.valori[i])])];
      break;
    case "box":
      righe = [[t("csvGruppo"), t("agg_minimo"), t("csvQ1"), t("agg_mediana"), t("csvQ3"), t("agg_massimo")], ...p.categorie.map((c, i) => [q(c), ...p.scatole[i].map(n)])];
      break;
  }
  return BOM + righe.map(riga).join("");
}
