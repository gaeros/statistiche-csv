// Traduttore per i test: legge i messaggi italiani e sostituisce i {segnaposto}, come fa next-intl.
import it from "../../messages/it.json";
import { creaFormati } from "@/lib/formato";
import type { Traduttore } from "@/i18n/lingue";

export function traduttore(gruppo: keyof typeof it): Traduttore {
  const voci = it[gruppo] as Record<string, string>;
  return (chiave, valori = {}) => {
    const testo = voci[chiave];
    if (testo === undefined) throw new Error(`Messaggio mancante: ${String(gruppo)}.${chiave}`);
    return testo.replace(/\{(\w+)\}/g, (_, k) => String(valori[k]));
  };
}

export const formatiIt = creaFormati("it");
