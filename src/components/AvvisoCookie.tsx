"use client";

// Avviso informativo sui cookie. L'app usa solo cookie tecnici, quindi non chiede un consenso:
// l'utente lo chiude una volta e la scelta resta nel browser (localStorage, non un cookie).

import { useTranslations } from "next-intl";
import Link from "next/link";
import { useSyncExternalStore } from "react";

const CHIAVE = "datahue-avviso-cookie";
const EVENTO = "datahue-avviso-cookie";

function osserva(avvisa: () => void) {
  window.addEventListener(EVENTO, avvisa);
  window.addEventListener("storage", avvisa);
  return () => {
    window.removeEventListener(EVENTO, avvisa);
    window.removeEventListener("storage", avvisa);
  };
}

function giàVisto(): boolean {
  try {
    return localStorage.getItem(CHIAVE) === "1";
  } catch {
    return false;
  }
}

export function AvvisoCookie() {
  const t = useTranslations("cookieBanner");
  // Sul server si considera già visto: l'avviso compare solo nel browser, dopo il primo disegno.
  const visto = useSyncExternalStore(osserva, giàVisto, () => true);
  if (visto) return null;

  const chiudi = () => {
    try {
      localStorage.setItem(CHIAVE, "1");
    } catch {
      /* senza localStorage l'avviso si richiude solo fino al prossimo caricamento */
    }
    window.dispatchEvent(new Event(EVENTO));
  };

  return (
    <div role="region" aria-label={t("titolo")} className="fixed inset-x-3 bottom-3 z-50 mx-auto max-w-5xl sm:bottom-5">
      <div className="grid overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_10px_40px_rgba(0,0,0,0.15)] md:grid-cols-[1fr_auto]">
        <div className="space-y-2 p-5 sm:p-7">
          <p className="text-lg font-medium">{t("titolo")}</p>
          <p className="text-slate-500">{t("testo")}</p>
        </div>
        <div className="flex flex-col justify-center gap-3 border-t border-slate-200 p-5 sm:p-7 md:min-w-72 md:border-l md:border-t-0">
          <button type="button" onClick={chiudi} className="bottone py-3">
            {t("ok")}
          </button>
          <Link href="/privacy#cookie" className="bottone-secondario py-3">
            {t("dettagli")}
          </Link>
        </div>
      </div>
    </div>
  );
}
