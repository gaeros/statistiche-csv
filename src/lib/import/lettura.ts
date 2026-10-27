// Lettura dei file CSV ed Excel nel browser (SPEC §4.3, §4.4).
// Il risultato è sempre una griglia di testi: i tipi si decidono dopo, colonna per colonna.

import Papa from "papaparse";
import * as XLSX from "xlsx";
import type { FormatoNumero } from "./tipi";

export type Encoding = "utf-8" | "windows-1252";

export type Foglio = {
  nome: string | null; // nome del foglio Excel, null per i CSV
  righe: string[][];
  formatoNumero: FormatoNumero;
};

export type FileLetto = {
  tipo: "csv" | "excel";
  fogli: Foglio[];
  encoding?: Encoding;
  separatore?: string;
};

export class ErroreLettura extends Error {}

export const ESTENSIONI_CSV = ["csv", "tsv", "txt"];
export const ESTENSIONI_EXCEL = ["xlsx", "xls"];
export const ESTENSIONI = [...ESTENSIONI_CSV, ...ESTENSIONI_EXCEL];

export function estensione(nomeFile: string): string {
  return nomeFile.split(".").pop()?.toLowerCase() ?? "";
}

// ---------------------------------------------------------------------------
// CSV
// ---------------------------------------------------------------------------

// Caratteri di Windows-1252 nell'intervallo 0x80–0x9F (es. 0x80 = €). Alcuni ambienti
// decodificano quell'intervallo come Latin-1, quindi la tabella si applica a mano.
const CP1252 =
  "\u20ac\u0081\u201a\u0192\u201e\u2026\u2020\u2021\u02c6\u2030\u0160\u2039\u0152\u008d\u017d\u008f" +
  "\u0090\u2018\u2019\u201c\u201d\u2022\u2013\u2014\u02dc\u2122\u0161\u203a\u0153\u009d\u017e\u0178";

function decodificaWindows1252(byte: Uint8Array): string {
  let testo = "";
  const BLOCCO = 8192;
  for (let i = 0; i < byte.length; i += BLOCCO) {
    const parte = byte.subarray(i, i + BLOCCO);
    testo += String.fromCharCode(
      ...Array.from(parte, (b) => (b >= 0x80 && b <= 0x9f ? CP1252.charCodeAt(b - 0x80) : b)),
    );
  }
  return testo;
}

export function decodifica(byte: Uint8Array, forzato?: Encoding): { testo: string; encoding: Encoding } {
  if (forzato === "windows-1252") return { testo: decodificaWindows1252(byte), encoding: forzato };
  if (forzato === "utf-8") {
    return { testo: new TextDecoder("utf-8").decode(byte).replace(/^\uFEFF/, ""), encoding: forzato };
  }
  try {
    // fatal: se il file non è UTF-8 valido lancia un errore e si prova Windows-1252.
    const testo = new TextDecoder("utf-8", { fatal: true }).decode(byte);
    return { testo: testo.replace(/^\uFEFF/, ""), encoding: "utf-8" };
  } catch {
    return { testo: decodificaWindows1252(byte), encoding: "windows-1252" };
  }
}

export function leggiCsv(testo: string, separatore?: string): { righe: string[][]; separatore: string } {
  const esito = Papa.parse<string[]>(testo, {
    delimiter: separatore ?? "",
    delimitersToGuess: [";", ",", "\t", "|"],
    skipEmptyLines: false,
  });
  const gravi = esito.errors.filter((e) => e.type === "Quotes");
  if (gravi.length > 0 && esito.data.length === 0) {
    throw new ErroreLettura("Il file CSV non è leggibile: virgolette non chiuse.");
  }
  return { righe: togliRigheVuoteInFondo(esito.data), separatore: esito.meta.delimiter };
}

function togliRigheVuoteInFondo(righe: string[][]): string[][] {
  let fine = righe.length;
  while (fine > 0 && righe[fine - 1].every((c) => (c ?? "").trim() === "")) fine--;
  return righe.slice(0, fine);
}

// ---------------------------------------------------------------------------
// Excel
// ---------------------------------------------------------------------------

const due = (n: number) => String(n).padStart(2, "0");

function testoCella(cella: XLSX.CellObject | undefined): string {
  if (!cella || cella.v === undefined || cella.v === null) return "";
  if (cella.t === "b") return cella.v ? "vero" : "falso";
  if (cella.t === "e") return "";
  if (cella.t === "n" && typeof cella.v === "number") {
    // Le date in Excel sono numeri con un formato data.
    if (cella.z && XLSX.SSF.is_date(cella.z)) {
      const d = XLSX.SSF.parse_date_code(cella.v);
      if (d) {
        const data = `${d.y}-${due(d.m)}-${due(d.d)}`;
        const intero = Number.isInteger(cella.v);
        return intero ? data : `${data} ${due(d.H)}:${due(d.M)}:${due(Math.round(d.S))}`;
      }
    }
    return String(cella.v);
  }
  return String(cella.v);
}

export function leggiExcel(dati: ArrayBuffer): Foglio[] {
  let libro: XLSX.WorkBook;
  try {
    libro = XLSX.read(dati, { type: "array", cellDates: false, cellNF: true, cellFormula: false });
  } catch (e) {
    const msg = String((e as Error)?.message ?? "").toLowerCase();
    if (msg.includes("password") || msg.includes("encrypt")) {
      throw new ErroreLettura("Il file Excel è protetto da password.");
    }
    throw new ErroreLettura("Il file Excel è danneggiato o non è un vero file Excel.");
  }

  return libro.SheetNames.map((nome) => {
    const foglio = libro.Sheets[nome];
    const area = foglio["!ref"] ? XLSX.utils.decode_range(foglio["!ref"]) : null;
    const righe: string[][] = [];
    if (area) {
      for (let r = area.s.r; r <= area.e.r; r++) {
        const riga: string[] = [];
        for (let c = area.s.c; c <= area.e.c; c++) {
          riga.push(testoCella(foglio[XLSX.utils.encode_cell({ r, c })]));
        }
        righe.push(riga);
      }
    }
    // I numeri di Excel arrivano con il punto decimale.
    return { nome, righe: togliRigheVuoteInFondo(righe), formatoNumero: "en" as const };
  });
}

// ---------------------------------------------------------------------------
// Ingresso unico
// ---------------------------------------------------------------------------

export async function leggiFile(
  file: File,
  opzioni: { encoding?: Encoding; separatore?: string } = {},
): Promise<FileLetto> {
  const est = estensione(file.name);
  const dati = await file.arrayBuffer();
  if (dati.byteLength === 0) throw new ErroreLettura("Il file è vuoto.");

  if (ESTENSIONI_EXCEL.includes(est)) {
    return { tipo: "excel", fogli: leggiExcel(dati) };
  }
  if (!ESTENSIONI_CSV.includes(est)) {
    throw new ErroreLettura(`Formato non supportato (.${est}). Usa CSV, TSV, TXT, XLSX o XLS.`);
  }

  const byte = new Uint8Array(dati);
  // Un file di testo non contiene byte nulli: se ci sono, non è un CSV.
  if (byte.subarray(0, 4096).includes(0)) {
    throw new ErroreLettura("Il file non sembra un CSV di testo (contenuto binario).");
  }
  const { testo, encoding } = decodifica(byte, opzioni.encoding);
  const { righe, separatore } = leggiCsv(testo, opzioni.separatore ?? (est === "tsv" ? "\t" : undefined));
  if (righe.length === 0) throw new ErroreLettura("Il file è vuoto.");
  return {
    tipo: "csv",
    encoding,
    separatore,
    // Con il punto e virgola come separatore i decimali usano di solito la virgola.
    fogli: [{ nome: null, righe, formatoNumero: separatore === "," ? "en" : "it" }],
  };
}
