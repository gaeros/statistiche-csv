// Lingue dell'app: l'italiano è la lingua di base.
export const LINGUE = ["it", "en"] as const;
export type Lingua = (typeof LINGUE)[number];
export const LINGUA_BASE: Lingua = "it";
export const COOKIE_LINGUA = "lingua";

export function èLingua(v: unknown): v is Lingua {
  return typeof v === "string" && (LINGUE as readonly string[]).includes(v);
}

// Intl vuole il nome completo della lingua (it-IT, en-GB).
export const LOCALE_INTL: Record<Lingua, string> = { it: "it-IT", en: "en-GB" };

// Traduttore di next-intl (useTranslations / getTranslations) visto dalle funzioni che non sono componenti.
export type Traduttore = (chiave: string, valori?: Record<string, string | number>) => string;

// Messaggio da tradurre più tardi (le funzioni di importazione non conoscono la lingua):
// `chiave` è una voce del gruppo "importa", `valori` i segnaposto.
export type Messaggio = { chiave: string; valori?: Record<string, string | number> };

export function tradotto(t: Traduttore, m: Messaggio): string {
  return t(m.chiave, m.valori);
}
