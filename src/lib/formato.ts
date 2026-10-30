// Formattazione di numeri e date secondo la lingua e i formati scelti dall'utente (SPEC §6.3).
import { LINGUA_BASE, LOCALE_INTL, èLingua, type Lingua } from "@/i18n/lingue";
import { PREFERENZE_BASE, type FormatoData, type Preferenze } from "./preferenze";

const TESTI = {
  it: { si: "Sì", no: "No", settimana: "sett. del" },
  en: { si: "Yes", no: "No", settimana: "week of" },
} as const;

export type Formati = ReturnType<typeof creaFormati>;

// Con «auto» data e decimali seguono la lingua: in italiano 27/10/2026 e 3,5; in inglese 27/10/2026 e 3.5.
const AUTO: Record<Lingua, { data: Exclude<FormatoData, "auto">; virgola: boolean }> = {
  it: { data: "gg/mm/aaaa", virgola: true },
  en: { data: "gg/mm/aaaa", virgola: false },
};

// Data da anno, mese e giorno (già a due cifre) nel formato scelto.
function scriviData(formato: Exclude<FormatoData, "auto">, a: string, m: string, g: string): string {
  if (formato === "aaaa-mm-gg") return `${a}-${m}-${g}`;
  if (formato === "mm/gg/aaaa") return `${m}/${g}/${a}`;
  return `${g}/${m}/${a}`;
}

// Parti di data e ora come le vede chi è in Italia.
const partiRoma = new Intl.DateTimeFormat("en-GB", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
  timeZone: "Europe/Rome",
});

export function creaFormati(lingua: string, preferenze: Preferenze = PREFERENZE_BASE) {
  const l: Lingua = èLingua(lingua) ? lingua : LINGUA_BASE;
  const locale = LOCALE_INTL[l];
  const testi = TESTI[l];
  const formatoData = preferenze.data === "auto" ? AUTO[l].data : preferenze.data;
  const virgola = preferenze.decimali === "auto" ? AUTO[l].virgola : preferenze.decimali === "virgola";
  // I numeri si scrivono come in italiano (1.234,5) o come in inglese (1,234.5), secondo il separatore decimale.
  const localeNumeri = virgola ? "it-IT" : "en-GB";

  const numeroFmt = new Intl.NumberFormat(localeNumeri, { maximumFractionDigits: 10 });
  const statisticaFmt = new Intl.NumberFormat(localeNumeri, { maximumFractionDigits: 2 });
  const meseFmt = new Intl.DateTimeFormat(locale, { month: "short", year: "numeric", timeZone: "UTC" });

  const numero = (n: number) => numeroFmt.format(n);
  // "2026-10-27" (anche con l'ora dopo) → data nel formato scelto; se non è una data la si lascia com'è.
  const data = (iso: string) => {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
    return m ? scriviData(formatoData, m[1], m[2], m[3]) : iso;
  };
  const dataOra = (iso: string) => {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    const p = Object.fromEntries(partiRoma.formatToParts(d).map((x) => [x.type, x.value]));
    return `${scriviData(formatoData, p.year, p.month, p.day)} ${p.hour}:${p.minute}`;
  };

  return {
    lingua: l,
    locale,
    // Locale di Intl per i numeri (it-IT o en-GB), es. per i grafici
    localeNumeri,
    formatoData,
    virgola,
    numero,
    data,
    dataOra,
    // Numero intero o decimale con al massimo `decimali` cifre dopo la virgola (per le dimensioni dei file).
    numeroCon: (n: number, decimali: number) => n.toLocaleString(localeNumeri, { maximumFractionDigits: decimali }),
    valore(valore: unknown, tipo: string): string {
      if (valore === null || valore === undefined) return "";
      switch (tipo) {
        case "intero":
        case "decimale":
          return numero(Number(valore));
        case "data":
          return data(String(valore));
        case "data_ora":
          return dataOra(String(valore));
        case "booleano":
          return valore ? testi.si : testi.no;
        default:
          return String(valore);
      }
    },
    // Numeri calcolati (medie, quartili...): al massimo due decimali.
    statistica(n: number | string | null | undefined): string {
      if (n === null || n === undefined || n === "") return "–";
      return statisticaFmt.format(Number(n));
    },
    percentuale(parte: number, totale: number): string {
      if (!totale) return "–";
      return `${statisticaFmt.format((parte / totale) * 100)}%`;
    },
    // Etichetta di un periodo: "2026-09-28" → "28/09/2026", "set 2026", "2026" ...
    periodo(iso: string, periodo: "day" | "week" | "month" | "year"): string {
      const d = new Date(`${iso.slice(0, 10)}T00:00:00Z`);
      if (periodo === "year") return String(d.getUTCFullYear());
      if (periodo === "month") return meseFmt.format(d);
      if (periodo === "week") return `${testi.settimana} ${data(iso)}`;
      return data(iso);
    },
    si: testi.si,
    no: testi.no,
  };
}
