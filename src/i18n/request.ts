import { cookies, headers } from "next/headers";
import { getRequestConfig } from "next-intl/server";
import { COOKIE_LINGUA, LINGUA_BASE, èLingua, type Lingua } from "./lingue";

// Lingua scelta: cookie, altrimenti la lingua del browser, altrimenti italiano. Niente prefisso negli indirizzi.
async function linguaRichiesta(): Promise<Lingua> {
  const scelta = (await cookies()).get(COOKIE_LINGUA)?.value;
  if (èLingua(scelta)) return scelta;
  const accetta = (await headers()).get("accept-language") ?? "";
  for (const voce of accetta.split(",")) {
    const codice = voce.trim().slice(0, 2).toLowerCase();
    if (èLingua(codice)) return codice;
  }
  return LINGUA_BASE;
}

export default getRequestConfig(async () => {
  const locale = await linguaRichiesta();
  return {
    locale,
    timeZone: "Europe/Rome",
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
