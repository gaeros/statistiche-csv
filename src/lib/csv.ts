// File CSV per Excel in italiano: separatore ";", virgola decimale, UTF-8 con BOM.

// Un testo che inizia con = + - @ verrebbe preso da Excel per una formula (CSV injection, SPEC §8.3):
// lo si fa precedere da un apostrofo. I numeri restano numeri, anche se negativi.
export function cellaTesto(s: string): string {
  const sicuro = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return /[";\r\n]/.test(sicuro) ? `"${sicuro.replace(/"/g, '""')}"` : sicuro;
}

export function cellaNumero(n: number | string | null | undefined): string {
  return n === null || n === undefined || n === "" ? "" : String(n).replace(".", ",");
}

const dataOra = new Intl.DateTimeFormat("it-IT", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Rome",
});

// Valore di una colonna del dataset, secondo il suo tipo.
export function cella(valore: unknown, tipo: string): string {
  if (valore === null || valore === undefined) return "";
  switch (tipo) {
    case "intero":
    case "decimale":
      return cellaNumero(valore as number);
    case "data": {
      const s = String(valore);
      return `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(0, 4)}`;
    }
    case "data_ora":
      return dataOra.format(new Date(String(valore))).replace(",", "");
    case "booleano":
      return valore ? "Sì" : "No";
    default:
      return cellaTesto(String(valore));
  }
}

export const riga = (celle: string[]) => celle.join(";") + "\r\n";
export const BOM = "﻿";
