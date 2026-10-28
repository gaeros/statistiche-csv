// Formattazione di numeri e date secondo la lingua dell'utente (SPEC §6.3).
import { LINGUA_BASE, LOCALE_INTL, èLingua, type Lingua } from "@/i18n/lingue";

const TESTI = {
  it: { si: "Sì", no: "No", settimana: "sett. del" },
  en: { si: "Yes", no: "No", settimana: "week of" },
} as const;

export type Formati = ReturnType<typeof creaFormati>;

export function creaFormati(lingua: string) {
  const l: Lingua = èLingua(lingua) ? lingua : LINGUA_BASE;
  const locale = LOCALE_INTL[l];
  const testi = TESTI[l];

  const numeroFmt = new Intl.NumberFormat(locale, { maximumFractionDigits: 10 });
  const statisticaFmt = new Intl.NumberFormat(locale, { maximumFractionDigits: 2 });
  const dataFmt = new Intl.DateTimeFormat(locale, { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" });
  const dataOraFmt = new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Rome",
  });
  const meseFmt = new Intl.DateTimeFormat(locale, { month: "short", year: "numeric", timeZone: "UTC" });

  const numero = (n: number) => numeroFmt.format(n);
  const dataOra = (iso: string) => dataOraFmt.format(new Date(iso));

  return {
    lingua: l,
    locale,
    numero,
    dataOra,
    // Numero intero o decimale con al massimo `decimali` cifre dopo la virgola (per le dimensioni dei file).
    numeroCon: (n: number, decimali: number) => n.toLocaleString(locale, { maximumFractionDigits: decimali }),
    valore(valore: unknown, tipo: string): string {
      if (valore === null || valore === undefined) return "";
      switch (tipo) {
        case "intero":
        case "decimale":
          return numero(Number(valore));
        case "data":
          return dataFmt.format(new Date(`${valore}T00:00:00Z`));
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
      const d = new Date(`${iso}T00:00:00Z`);
      if (periodo === "year") return String(d.getUTCFullYear());
      if (periodo === "month") return meseFmt.format(d);
      if (periodo === "week") return `${testi.settimana} ${dataFmt.format(d)}`;
      return dataFmt.format(d);
    },
    si: testi.si,
    no: testi.no,
  };
}
