// File Excel (.xlsx) di un dataset. SheetJS qui serve solo a scrivere: non legge file degli utenti,
// quindi i difetti noti di xlsx 0.18.5 (tutti nella lettura) non riguardano questa parte.
import * as XLSX from "xlsx";
import type { Colonna } from "./filtri";
import type { FormatoData } from "./preferenze";

type Cella = XLSX.CellObject;

// Giorni tra il 30/12/1899 (giorno 0 di Excel) e il 01/01/1970.
const EPOCA_EXCEL = 25569;
const GIORNO = 86_400_000;

const partiRoma = new Intl.DateTimeFormat("en-GB", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
  timeZone: "Europe/Rome",
});

// Excel non conosce i fusi orari: data e ora si scrivono come le vede chi è in Italia (come nel CSV).
function serialeDataOra(iso: string): number | null {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const p = Object.fromEntries(partiRoma.formatToParts(d).map((x) => [x.type, x.value]));
  const utc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
  return utc / GIORNO + EPOCA_EXCEL;
}

function serialeData(s: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  return m ? Date.UTC(+m[1], +m[2] - 1, +m[3]) / GIORNO + EPOCA_EXCEL : null;
}

// Formato di visualizzazione delle date in Excel, come scelto in «Il mio account». Il separatore
// decimale invece lo decide Excel con la lingua del computer: i numeri restano numeri.
const FORMATO_EXCEL: Record<Exclude<FormatoData, "auto">, string> = {
  "gg/mm/aaaa": "dd/mm/yyyy",
  "mm/gg/aaaa": "mm/dd/yyyy",
  "aaaa-mm-gg": "yyyy-mm-dd",
};

// Valore di una colonna del dataset come cella Excel: numeri e date restano numeri e date,
// così in Excel si possono sommare e ordinare. I testi sono sempre testo, mai formule.
export function cellaExcel(
  valore: unknown,
  tipo: string,
  si = "Sì",
  no = "No",
  formatoData: Exclude<FormatoData, "auto"> = "gg/mm/aaaa",
): Cella | null {
  const z = FORMATO_EXCEL[formatoData];
  if (valore === null || valore === undefined || valore === "") return null;
  switch (tipo) {
    case "intero":
    case "decimale": {
      const n = Number(valore);
      return Number.isFinite(n) ? { t: "n", v: n } : { t: "s", v: String(valore) };
    }
    case "data": {
      const v = serialeData(String(valore));
      return v === null ? { t: "s", v: String(valore) } : { t: "n", v, z };
    }
    case "data_ora": {
      const v = serialeDataOra(String(valore));
      return v === null ? { t: "s", v: String(valore) } : { t: "n", v, z: `${z} hh:mm` };
    }
    case "booleano":
      return { t: "s", v: valore ? si : no };
    default:
      return { t: "s", v: String(valore) };
  }
}

// Il nome di un foglio Excel ha al massimo 31 caratteri e non può contenere : \ / ? * [ ].
export function nomeFoglio(nome: string): string {
  const pulito = nome.replace(/[:\\/?*[\]]/g, "_").replace(/^'+|'+$/g, "").trim();
  return pulito.slice(0, 31) || "Dati";
}

// Un foglio con le intestazioni originali nella prima riga, il filtro automatico di Excel
// e colonne larghe quanto basta per leggerle.
export function creaExcel(
  nome: string,
  colonne: Colonna[],
  righe: Record<string, unknown>[],
  si = "Sì",
  no = "No",
  formatoData: Exclude<FormatoData, "auto"> = "gg/mm/aaaa",
): Uint8Array {
  const foglio: XLSX.WorkSheet = {};
  const larghezze = colonne.map((c) => Math.max(8, c.originale.length));

  colonne.forEach((c, x) => {
    foglio[XLSX.utils.encode_cell({ r: 0, c: x })] = { t: "s", v: c.originale };
  });
  righe.forEach((r, y) => {
    colonne.forEach((c, x) => {
      const cella = cellaExcel(r[c.nome], c.tipo, si, no, formatoData);
      if (!cella) return;
      foglio[XLSX.utils.encode_cell({ r: y + 1, c: x })] = cella;
      const lunghezza = String(cella.z ?? cella.v).length;
      larghezze[x] = Math.max(larghezze[x], Math.min(lunghezza, 60));
    });
  });

  const ultima = XLSX.utils.encode_cell({ r: righe.length, c: Math.max(colonne.length - 1, 0) });
  foglio["!ref"] = `A1:${ultima}`;
  if (colonne.length) foglio["!autofilter"] = { ref: foglio["!ref"] };
  foglio["!cols"] = larghezze.map((w) => ({ wch: w + 2 }));

  const libro = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(libro, foglio, nomeFoglio(nome));
  return new Uint8Array(XLSX.write(libro, { type: "array", bookType: "xlsx", compression: true }) as ArrayBuffer);
}
