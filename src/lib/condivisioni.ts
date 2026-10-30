// Link di sola lettura per un grafico salvato o per la dashboard (tabella public.condivisioni, SPEC §6.4).

// Scadenze proposte, in giorni; "mai" = finché non si revoca. La prima è quella proposta.
export const SCADENZE = ["30", "7", "1", "90", "mai"] as const;
export type Scadenza = (typeof SCADENZE)[number];

// Valore del campo "cosa condividere" per la dashboard (per un grafico è il suo id).
export const DASHBOARD = "dashboard";

const GIORNO = 24 * 3600 * 1000;

export function leggiScadenza(v: unknown): Scadenza {
  return SCADENZE.includes(v as Scadenza) ? (v as Scadenza) : SCADENZE[0];
}

// Data di scadenza da salvare (ISO), o null se il link non scade.
export function dataScadenza(s: Scadenza, adesso = new Date()): string | null {
  return s === "mai" ? null : new Date(adesso.getTime() + Number(s) * GIORNO).toISOString();
}

export function scaduto(scadeIl: string | null, adesso = new Date()): boolean {
  return scadeIl !== null && new Date(scadeIl).getTime() <= adesso.getTime();
}

// Il codice del link lo crea il database: 64 caratteri esadecimali.
export function codiceValido(token: string): boolean {
  return /^[0-9a-f]{64}$/.test(token);
}

export function percorsoCondiviso(token: string): string {
  return `/condiviso/${token}`;
}
