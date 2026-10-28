export type Colonna = { nome: string; originale: string; tipo: string };

export type StatColonna = Colonna & {
  valori: number;
  mancanti: number;
  distinti: number;
  // numeriche
  minimo?: number;
  massimo?: number;
  somma?: number;
  media?: number;
  dev_std?: number | null;
  q1?: number;
  mediana?: number;
  q3?: number;
  anomali?: number;
  soglia_bassa?: number;
  soglia_alta?: number;
  istogramma?: { da: number; a: number; conteggio: number }[];
  // testo e sì/no
  frequenti?: { valore: string; conteggio: number }[];
  // date
  prima?: string;
  ultima?: string;
  giorni?: number;
};

export type Statistiche = { totale: number; complessivo: number; colonne: StatColonna[] };

export const NUMERICI = ["intero", "decimale"];
export const DATE = ["data", "data_ora"];

export const PERIODI = { day: "giorno", week: "settimana", month: "mese", year: "anno" } as const;
export type Periodo = keyof typeof PERIODI;

export const AGGREGAZIONI = {
  conteggio: "Conteggio righe",
  somma: "Somma",
  media: "Media",
  mediana: "Mediana",
  minimo: "Minimo",
  massimo: "Massimo",
} as const;
export type Aggregazione = keyof typeof AGGREGAZIONI;
