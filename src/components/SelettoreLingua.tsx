"use client";

import { useLocale, useTranslations } from "next-intl";
import { useTransition } from "react";
import { impostaLingua } from "@/i18n/azioni";
import { LINGUE } from "@/i18n/lingue";

// Due pulsanti IT | EN, ognuno una pillola come «Esci»: scelgono la lingua per tutto il sito.
export function SelettoreLingua({ className = "" }: { className?: string }) {
  const attuale = useLocale();
  const t = useTranslations("lingua");
  const [, avvia] = useTransition();
  return (
    <div role="group" aria-label={t("etichetta")} className={`inline-flex items-center gap-1 text-sm ${className}`}>
      {LINGUE.map((l) => (
        <button
          key={l}
          type="button"
          lang={l}
          aria-pressed={l === attuale}
          title={t(l)}
          onClick={() => avvia(() => impostaLingua(l))}
          className={`flex h-9 w-10 items-center justify-center rounded-full border focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground sm:w-11 font-semibold uppercase ${l === attuale ? "border-foreground bg-foreground text-white" : "border-slate-300 bg-white text-foreground hover:bg-slate-100"}`}
        >
          {l}
        </button>
      ))}
    </div>
  );
}
