// Ordine delle schede «Colonna per colonna» scelto dall'utente.

// Mette prima le chiavi salvate (se esistono ancora), poi le altre nell'ordine originale.
export function applicaOrdine(originale: string[], salvato: readonly string[]): string[] {
  const presenti = new Set(originale);
  const prima = [...new Set(salvato)].filter((k) => presenti.has(k));
  const messe = new Set(prima);
  return [...prima, ...originale.filter((k) => !messe.has(k))];
}

// Sposta l'elemento in posizione `da` alla posizione `a` (restituisce un nuovo array).
export function sposta<T>(lista: readonly T[], da: number, a: number): T[] {
  const nuova = [...lista];
  if (da < 0 || da >= nuova.length) return nuova;
  const [voce] = nuova.splice(da, 1);
  nuova.splice(Math.max(0, Math.min(a, nuova.length)), 0, voce);
  return nuova;
}

export function stessoOrdine(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((k, i) => k === b[i]);
}
