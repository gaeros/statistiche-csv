// Formati scelti dall'utente in «Il mio account» (SPEC §6.3): come scrivere le date e quale
// separatore decimale usare. Sono salvati nei metadati dell'utente di Supabase (chiave `formati`),
// accanto al consenso privacy: niente tabella in più. «auto» segue la lingua dell'app.

export const FORMATI_DATA = ["auto", "gg/mm/aaaa", "mm/gg/aaaa", "aaaa-mm-gg"] as const;
export const FORMATI_DECIMALI = ["auto", "virgola", "punto"] as const;

export type FormatoData = (typeof FORMATI_DATA)[number];
export type FormatoDecimali = (typeof FORMATI_DECIMALI)[number];
export type Preferenze = { data: FormatoData; decimali: FormatoDecimali };

export const PREFERENZE_BASE: Preferenze = { data: "auto", decimali: "auto" };

const tra = <T extends string>(elenco: readonly T[], v: unknown, base: T): T =>
  typeof v === "string" && (elenco as readonly string[]).includes(v) ? (v as T) : base;

// Legge le preferenze dai metadati dell'utente; valori mancanti o sconosciuti tornano «auto».
export function leggiPreferenze(metadati: unknown): Preferenze {
  const f = (metadati as { formati?: Partial<Record<keyof Preferenze, unknown>> } | null | undefined)?.formati;
  return { data: tra(FORMATI_DATA, f?.data, "auto"), decimali: tra(FORMATI_DECIMALI, f?.decimali, "auto") };
}
