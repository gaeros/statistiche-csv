// Dashboard personale: elenco ordinato degli id dei grafici fissati (tabella public.dashboard).

export const MAX_FISSATI = 50;

// Aggiunge il grafico in fondo; null se la dashboard è già piena.
export function fissa(lista: readonly string[], id: string, max = MAX_FISSATI): string[] | null {
  if (lista.includes(id)) return [...lista];
  return lista.length >= max ? null : [...lista, id];
}

export function togli(lista: readonly string[], id: string): string[] {
  return lista.filter((x) => x !== id);
}

// Nuovo ordine chiesto dalla pagina: vale solo per i grafici ancora fissati (un grafico tolto
// nel frattempo non torna); quelli fissati ma non elencati restano in fondo.
export function riordina(salvati: readonly string[], richiesti: readonly string[]): string[] {
  const fissati = new Set(salvati);
  const prima = [...new Set(richiesti)].filter((x) => fissati.has(x));
  const messi = new Set(prima);
  return [...prima, ...salvati.filter((x) => !messi.has(x))];
}
