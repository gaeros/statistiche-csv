"use client";

import { useLocale, useTranslations } from "next-intl";
import { useTransition } from "react";
import { impostaLingua } from "@/i18n/azioni";
import { LINGUE } from "@/i18n/lingue";

// Due pulsanti IT | EN: scelgono la lingua per tutto il sito.
export function SelettoreLingua({ className = "", nero = true }: { className?: string; nero?: boolean }) {
  const attuale = useLocale();
  const t = useTranslations("lingua");
  const [, avvia] = useTransition();
  return (
    <div role="group" aria-label={t("etichetta")} className={`inline-flex overflow-hidden ${nero ? "rounded-full" : "rounded-md"} border border-slate-300 text-sm ${className}`}>
      {LINGUE.map((l) => (
        <button
          key={l}
          type="button"
          lang={l}
          aria-pressed={l === attuale}
          title={t(l)}
          onClick={() => avvia(() => impostaLingua(l))}
          className={`px-3 py-1.5 font-medium uppercase ${l === attuale ? (nero ? "bg-foreground text-white" : "bg-blue-600 text-white") : "bg-white text-slate-700 hover:bg-slate-100"}`}
        >
          {l}
        </button>
      ))}
    </div>
  );
}
