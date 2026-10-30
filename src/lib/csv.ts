// File CSV per Excel, UTF-8 con BOM. Con la virgola decimale (Excel in italiano) le celle sono
// separate da ";"; con il punto decimale (Excel in inglese) da ",". Le date seguono il formato scelto.
import { creaFormati, type Formati } from "./formato";

type FormatiCsv = Pick<Formati, "virgola" | "data" | "dataOra" | "si" | "no">;
const BASE = creaFormati("it");

// Un testo che inizia con = + - @ verrebbe preso da Excel per una formula (CSV injection, SPEC §8.3):
// lo si fa precedere da un apostrofo. I numeri restano numeri, anche se negativi.
export function cellaTesto(s: string): string {
  const sicuro = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return /[";,\r\n]/.test(sicuro) ? `"${sicuro.replace(/"/g, '""')}"` : sicuro;
}

export function cellaNumero(n: number | string | null | undefined, virgola = true): string {
  if (n === null || n === undefined || n === "") return "";
  return virgola ? String(n).replace(".", ",") : String(n);
}

// Valore di una colonna del dataset, secondo il suo tipo.
export function cella(valore: unknown, tipo: string, f: FormatiCsv = BASE): string {
  if (valore === null || valore === undefined) return "";
  switch (tipo) {
    case "intero":
    case "decimale":
      return cellaNumero(valore as number, f.virgola);
    case "data":
      return f.data(String(valore));
    case "data_ora":
      return f.dataOra(String(valore));
    case "booleano":
      return valore ? f.si : f.no;
    default:
      return cellaTesto(String(valore));
  }
}

export const riga = (celle: string[], virgola = true) => celle.join(virgola ? ";" : ",") + "\r\n";
export const BOM = "﻿";
