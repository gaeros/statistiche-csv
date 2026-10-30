"use client";

import { useTranslations } from "next-intl";
import { useState, useSyncExternalStore } from "react";

const nessunCambio = () => () => {};

// Campo con l'indirizzo completo di un link condiviso e il pulsante per copiarlo.
// L'indirizzo si compone nel browser, così è giusto sia in locale sia online.
export function CopiaLink({ percorso, etichetta }: { percorso: string; etichetta: string }) {
  const t = useTranslations("condivisioni");
  const origine = useSyncExternalStore(nessunCambio, () => window.location.origin, () => "");
  const url = origine + percorso;
  const [copiato, setCopiato] = useState(false);

  async function copia() {
    try {
      await navigator.clipboard.writeText(url);
      setCopiato(true);
      setTimeout(() => setCopiato(false), 2000);
    } catch {
      setCopiato(false);
    }
  }

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-2">
      <input
        readOnly
        value={url}
        aria-label={etichetta}
        onFocus={(e) => e.currentTarget.select()}
        className="campo min-w-0 flex-1 py-1.5 font-mono text-xs"
      />
      <button type="button" onClick={copia} className="bottone-secondario px-3 py-1.5 text-sm">
        {copiato ? t("copiato") : t("copia")}
      </button>
      <span className="sr-only" aria-live="polite">{copiato ? t("copiato") : ""}</span>
    </div>
  );
}
