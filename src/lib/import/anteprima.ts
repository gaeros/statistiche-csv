// Dalla griglia letta dal file all'anteprima modificabile, e poi alle righe da inserire.

import {
  deduplica,
  MAX_NOME_TABELLA,
  nomeFileSenzaEstensione,
  sanificaNomeColonna,
  sanificaNomeTabella,
} from "./nomi";
import type { Foglio } from "./lettura";
import { converti, convertiData, convertiNumero, mancante, rilevaTipo, type FormatoNumero, type Tipo, type Valore } from "./tipi";

export type ColonnaAnteprima = {
  indice: number; // posizione nel file
  originale: string;
  nome: string;
  tipo: Tipo;
  tipoRilevato: Tipo;
  formatoNumero: FormatoNumero;
  includi: boolean;
  vuota: boolean;
  mancanti: number;
  avvisi: string[];
};

export type Anteprima = {
  nomeTabella: string;
  nomeOriginale: string;
  foglio: string | null;
  rigaIntestazione: number; // 1 = prima riga del file
  intestazioneSospetta: boolean;
  senzaIntestazione: boolean;
  colonne: ColonnaAnteprima[];
  righe: string[][]; // righe di dati, senza intestazione
  avvisi: string[];
};

function sembraDato(v: string): boolean {
  const s = v.trim();
  return s !== "" && (convertiNumero(s, "it") !== null || convertiNumero(s, "en") !== null || convertiData(s) !== null);
}

export function creaAnteprima(
  foglio: Foglio,
  nomeFile: string,
  opzioni: { rigaIntestazione?: number; senzaIntestazione?: boolean } = {},
): Anteprima {
  const rigaIntestazione = Math.max(1, opzioni.rigaIntestazione ?? 1);
  const griglia = foglio.righe.slice(rigaIntestazione - 1);
  const intestazione = griglia[0] ?? [];
  const intestazioneSospetta =
    intestazione.length > 0 && intestazione.filter((c) => c.trim() !== "").every(sembraDato);
  const senzaIntestazione = opzioni.senzaIntestazione ?? false;

  const datiGrezzi = senzaIntestazione ? griglia : griglia.slice(1);
  const avvisi: string[] = [];

  // Righe completamente vuote in mezzo al file: scartate.
  const righe = datiGrezzi.filter((r) => r.some((c) => (c ?? "").trim() !== ""));
  const scartate = datiGrezzi.length - righe.length;
  if (scartate > 0) avvisi.push(`${scartate} righe vuote scartate.`);

  const numColonne = Math.max(intestazione.length, ...righe.map((r) => r.length), 0);
  const conCelleInPiu = righe.filter((r) => r.length > intestazione.length && r.slice(intestazione.length).some((c) => c.trim() !== "")).length;
  if (!senzaIntestazione && conCelleInPiu > 0) {
    avvisi.push(`${conCelleInPiu} righe hanno più celle delle intestazioni: le colonne in più si chiamano colonna_N.`);
  }

  const originali = Array.from({ length: numColonne }, (_, i) =>
    senzaIntestazione ? "" : (intestazione[i] ?? "").replace(/^\uFEFF/, "").trim(),
  );
  const nomi = deduplica(originali.map((o, i) => sanificaNomeColonna(o, i + 1)));

  const colonne: ColonnaAnteprima[] = originali.map((originale, i) => {
    const valori = righe.map((r) => r[i] ?? "");
    const ril = rilevaTipo(valori, foglio.formatoNumero);
    const avvisiColonna: string[] = [];
    const vuota = ril.valori === 0;
    if (vuota) avvisiColonna.push("Colonna sempre vuota: proposta di non importarla.");
    else if (ril.avviso) avvisiColonna.push(ril.avviso);
    const mostrato = originale || `colonna_${i + 1}`;
    if (originale && nomi[i] !== originale.toLowerCase()) avvisiColonna.push(`Rinominata da "${originale}".`);
    return {
      indice: i,
      originale: mostrato,
      nome: nomi[i],
      tipo: ril.tipo,
      tipoRilevato: ril.tipo,
      formatoNumero: ril.formatoNumero,
      includi: !vuota,
      vuota,
      mancanti: ril.mancanti,
      avvisi: avvisiColonna,
    };
  });

  const base = nomeFileSenzaEstensione(nomeFile);
  const nomeTabella = sanificaNomeTabella(foglio.nome ? `${base}_${foglio.nome}` : base);

  return {
    nomeTabella: nomeTabella.slice(0, MAX_NOME_TABELLA),
    nomeOriginale: nomeFile,
    foglio: foglio.nome,
    rigaIntestazione,
    intestazioneSospetta: intestazioneSospetta && !senzaIntestazione,
    senzaIntestazione,
    colonne,
    righe,
    avvisi,
  };
}

export type RigaDati = Record<string, Valore>;

// Converte le righe nei tipi scelti. Conta i valori non convertibili per colonna.
export function preparaRighe(a: Anteprima): { righe: RigaDati[]; nonConvertiti: Record<string, number> } {
  const incluse = a.colonne.filter((c) => c.includi);
  const nonConvertiti: Record<string, number> = {};
  const righe = a.righe.map((r) => {
    const riga: RigaDati = {};
    for (const c of incluse) {
      const grezzo = r[c.indice] ?? "";
      const valore = converti(grezzo, c.tipo, c.formatoNumero);
      if (valore === null && !mancante(grezzo)) {
        nonConvertiti[c.nome] = (nonConvertiti[c.nome] ?? 0) + 1;
      }
      riga[c.nome] = valore;
    }
    return riga;
  });
  return { righe, nonConvertiti };
}
