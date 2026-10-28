// Traduce i messaggi più comuni di Supabase Auth. `t` è il traduttore del gruppo "erroriAuth".
import type { Traduttore } from "@/i18n/lingue";

export type { Traduttore };

export function erroreAuth(t: Traduttore, messaggio: string | undefined | null): string {
  if (!messaggio) return t("generico");
  const m = messaggio.toLowerCase();
  if (m.includes("invalid login credentials")) return t("credenziali");
  if (m.includes("email not confirmed")) return t("nonConfermata");
  if (m.includes("invito") || m.includes("signups not allowed") || m.includes("not allowed")) return t("soloInvito");
  if (m.includes("password should be") || m.includes("weak password")) return t("passwordDebole");
  if (m.includes("same password") || m.includes("different from the old")) return t("passwordUguale");
  if (m.includes("rate limit") || m.includes("too many")) return t("troppiTentativi");
  if (m.includes("expired") || (m.includes("invalid") && m.includes("token"))) return t("linkScaduto");
  return messaggio;
}
