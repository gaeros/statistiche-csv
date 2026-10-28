// Colori dei grafici: otto tinte in ordine fisso, scelte per restare distinguibili anche da chi
// non vede bene i colori; la versione scura ha le stesse tinte adattate allo sfondo scuro.
const SERIE_CHIARO = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#6250d6", "#e34948"];
const SERIE_SCURO = ["#3987e5", "#d95926", "#199e70", "#c98500", "#d55181", "#008300", "#9085e9", "#e66767"];

export type Colori = {
  formatta: (n: unknown) => string;
  serie: string[];
  sfondo: string;
  testo: string;
  testoTenue: string;
  griglia: string;
  tooltip: string;
};

const formatiNumero = new Map<string, Intl.NumberFormat>();

// `locale` è quello di Intl (it-IT, en-GB): i numeri dei grafici seguono la lingua dell'utente.
export function colori(scuro: boolean, locale = "it-IT"): Colori {
  let fmt = formatiNumero.get(locale);
  if (!fmt) formatiNumero.set(locale, (fmt = new Intl.NumberFormat(locale, { maximumFractionDigits: 2 })));
  const formatta = (n: unknown) =>
    n === null || n === undefined || n === "" || Number.isNaN(Number(n)) ? "–" : fmt.format(Number(n));
  return scuro
    ? { formatta, serie: SERIE_SCURO, sfondo: "#0f172a", testo: "#e2e8f0", testoTenue: "#94a3b8", griglia: "#1e293b", tooltip: "#1e293b" }
    : { formatta, serie: SERIE_CHIARO, sfondo: "#ffffff", testo: "#0f172a", testoTenue: "#64748b", griglia: "#e2e8f0", tooltip: "#ffffff" };
}

export function stileTooltip(c: Colori) {
  return {
    backgroundColor: c.tooltip,
    borderColor: c.griglia,
    textStyle: { color: c.testo, fontSize: 13 },
    extraCssText: "box-shadow: 0 4px 12px rgb(0 0 0 / 0.12); border-radius: 8px;",
  };
}

export function stileAssi(c: Colori) {
  return {
    axisLine: { lineStyle: { color: c.griglia } },
    axisTick: { show: false },
    axisLabel: { color: c.testoTenue, hideOverlap: true },
    splitLine: { lineStyle: { color: c.griglia } },
  };
}
