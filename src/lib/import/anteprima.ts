// Dalla griglia letta dal file all'anteprima modificabile, e poi alle righe da inserire.

import type { Messaggio } from "@/i18n/lingue";
import {
  deduplica,
  MAX_NOME_TABELLA,
  nomeFileSenzaEstensione,
  sanificaNomeColonna,
  sanificaNomeTabella,
} from "./nomi";
import type { Foglio } from "./lettura";
import {
  converti,
  convertiData,
  convertiNumero,
  mancante,
  rilevaTipo,
  valido,
  type FormatoNumero,
  type Tipo,
  type Valore,
} from "./tipi";

// Cosa fare con i valori che non si convertono nel tipo scelto (e non sono stati corretti).
export type SeNonConforme = "vuoto" | "escludi";

export type ColonnaAnteprima = {
  indice: number; // posizione nel file
  originale: string;
  nome: string;
  tipo: Tipo;
  tipoRilevato: Tipo;
  tipoSuggerito?: Tipo; // quasi tutti i valori sono di questo tipo: si propone di usarlo e correggere gli altri
  formatoNumero: FormatoNumero;
  includi: boolean;
  vuota: boolean;
  mancanti: number;
  avvisi: Messaggio[];
  correzioni: Record<string, string>; // valore nel file -> valore corretto (vale se il tipo non è testo)
  seNonConforme: SeNonConforme;
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
  numeriRiga: number[]; // per ogni riga di dati, il suo numero nel file (1 = prima riga)
  avvisi: Messaggio[];
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
  const primaRigaDati = rigaIntestazione + (senzaIntestazione ? 0 : 1);
  const avvisi: Messaggio[] = [];

  // Righe completamente vuote in mezzo al file: scartate.
  const righe: string[][] = [];
  const numeriRiga: number[] = [];
  datiGrezzi.forEach((r, i) => {
    if (r.some((c) => (c ?? "").trim() !== "")) {
      righe.push(r);
      numeriRiga.push(primaRigaDati + i);
    }
  });
  const scartate = datiGrezzi.length - righe.length;
  if (scartate > 0) avvisi.push({ chiave: "righeVuoteScartate", valori: { n: scartate } });

  const numColonne = Math.max(intestazione.length, ...righe.map((r) => r.length), 0);
  const conCelleInPiu = righe.filter((r) => r.length > intestazione.length && r.slice(intestazione.length).some((c) => c.trim() !== "")).length;
  if (!senzaIntestazione && conCelleInPiu > 0) {
    avvisi.push({ chiave: "celleInPiu", valori: { n: conCelleInPiu } });
  }

  const originali = Array.from({ length: numColonne }, (_, i) =>
    senzaIntestazione ? "" : (intestazione[i] ?? "").replace(/^\uFEFF/, "").trim(),
  );
  const nomi = deduplica(originali.map((o, i) => sanificaNomeColonna(o, i + 1)));

  const colonne: ColonnaAnteprima[] = originali.map((originale, i) => {
    const valori = righe.map((r) => r[i] ?? "");
    const ril = rilevaTipo(valori, foglio.formatoNumero);
    const avvisiColonna: Messaggio[] = [];
    const vuota = ril.valori === 0;
    if (vuota) avvisiColonna.push({ chiave: "colonnaSempreVuota" });
    else if (ril.avviso) avvisiColonna.push(ril.avviso);
    const mostrato = originale || `colonna_${i + 1}`;
    if (originale && nomi[i] !== originale.toLowerCase()) avvisiColonna.push({ chiave: "rinominata", valori: { originale } });
    return {
      indice: i,
      originale: mostrato,
      nome: nomi[i],
      tipo: ril.tipo,
      tipoRilevato: ril.tipo,
      tipoSuggerito: ril.suggerito,
      formatoNumero: ril.formatoNumero,
      includi: !vuota,
      vuota,
      mancanti: ril.mancanti,
      avvisi: avvisiColonna,
      correzioni: {},
      seNonConforme: "vuoto",
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
    numeriRiga,
    avvisi,
  };
}

// Gli avvisi della colonna ancora validi: "importata come testo" non vale più se l'utente ha scelto un altro tipo.
export function avvisiColonna(c: ColonnaAnteprima): Messaggio[] {
  return c.tipo === "testo" ? c.avvisi : c.avvisi.filter((x) => !x.chiave.startsWith("avvNon"));
}

// Il valore da convertire, dopo l'eventuale correzione scritta nell'anteprima.
export function valoreCorretto(grezzo: string, c: ColonnaAnteprima): string {
  if (c.tipo === "testo") return grezzo;
  return Object.hasOwn(c.correzioni, grezzo) ? c.correzioni[grezzo] : grezzo;
}

export function conforme(grezzo: string, c: ColonnaAnteprima): boolean {
  const v = valoreCorretto(grezzo, c);
  return mancante(v) || valido(v, c.tipo, c.formatoNumero);
}

export type ValoreNonConforme = { valore: string; righe: number[] }; // righe = posizioni in Anteprima.righe

// Valori del file che non si convertono nel tipo scelto, raggruppati per valore.
// Un valore corretto in un altro valido non compare più; uno corretto male sì.
// Con `prima` le correzioni sono ignorate: serve per l'elenco dei valori da correggere,
// che non deve cambiare mentre si scrive.
export function nonConformi(a: Anteprima, colonna: ColonnaAnteprima, prima = false): ValoreNonConforme[] {
  if (!colonna.includi || colonna.tipo === "testo") return [];
  const c = prima ? { ...colonna, correzioni: {} } : colonna;
  const gruppi = new Map<string, number[]>();
  const validi = new Map<string, boolean>();
  a.righe.forEach((r, i) => {
    const grezzo = r[c.indice] ?? "";
    let ok = validi.get(grezzo);
    if (ok === undefined) {
      ok = conforme(grezzo, c);
      validi.set(grezzo, ok);
    }
    if (ok) return;
    const righe = gruppi.get(grezzo);
    if (righe) righe.push(i);
    else gruppi.set(grezzo, [i]);
  });
  return [...gruppi].map(([valore, righe]) => ({ valore, righe }));
}

export type Riepilogo = {
  righe: number; // righe che verranno importate
  escluse: number; // righe escluse per valori non conformi
  vuoti: number; // valori non conformi che resteranno vuoti
  corretti: number; // valori corretti a mano
};

export function riepilogo(a: Anteprima): Riepilogo {
  const controllate = a.colonne
    .filter((c) => c.includi && c.tipo !== "testo")
    .map((c) => ({ c, esiti: new Map<string, boolean>() }));
  const ok = ({ c, esiti }: (typeof controllate)[number], grezzo: string) => {
    let esito = esiti.get(grezzo);
    if (esito === undefined) {
      esito = conforme(grezzo, c);
      esiti.set(grezzo, esito);
    }
    return esito;
  };
  const totale: Riepilogo = { righe: 0, escluse: 0, vuoti: 0, corretti: 0 };
  for (const r of a.righe) {
    const esclusa = controllate.some((x) => x.c.seNonConforme === "escludi" && !ok(x, r[x.c.indice] ?? ""));
    if (esclusa) {
      totale.escluse++;
      continue;
    }
    totale.righe++;
    for (const x of controllate) {
      const grezzo = r[x.c.indice] ?? "";
      if (!ok(x, grezzo)) totale.vuoti++;
      else if (valoreCorretto(grezzo, x.c) !== grezzo) totale.corretti++;
    }
  }
  return totale;
}

export type RigaDati = Record<string, Valore>;

// Converte le righe nei tipi scelti, con le correzioni dell'anteprima.
// Conta per colonna i valori non convertibili (lasciati vuoti) e quelli corretti;
// salta le righe con un valore non conforme in una colonna impostata su "escludi".
export function preparaRighe(a: Anteprima): {
  righe: RigaDati[];
  nonConvertiti: Record<string, number>;
  corretti: Record<string, number>;
  escluse: number;
} {
  const incluse = a.colonne.filter((c) => c.includi);
  const nonConvertiti: Record<string, number> = {};
  const corretti: Record<string, number> = {};
  const righe: RigaDati[] = [];
  let escluse = 0;
  for (const r of a.righe) {
    const riga: RigaDati = {};
    const nonConvertitiRiga: string[] = [];
    const correttiRiga: string[] = [];
    let esclusa = false;
    for (const c of incluse) {
      const grezzo = r[c.indice] ?? "";
      const v = valoreCorretto(grezzo, c);
      const valore = converti(v, c.tipo, c.formatoNumero);
      if (valore === null && !mancante(v)) {
        if (c.seNonConforme === "escludi") {
          esclusa = true;
          break;
        }
        nonConvertitiRiga.push(c.nome);
      } else if (v !== grezzo) {
        correttiRiga.push(c.nome);
      }
      riga[c.nome] = valore;
    }
    if (esclusa) {
      escluse++;
      continue;
    }
    for (const n of nonConvertitiRiga) nonConvertiti[n] = (nonConvertiti[n] ?? 0) + 1;
    for (const n of correttiRiga) corretti[n] = (corretti[n] ?? 0) + 1;
    righe.push(riga);
  }
  return { righe, nonConvertiti, corretti, escluse };
}
