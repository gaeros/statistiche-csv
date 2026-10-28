"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { useActionState } from "react";
import { esci } from "@/app/accedi/actions";
import { Messaggio } from "@/components/Messaggio";
import { PaginaAuth } from "@/components/PaginaAuth";
import { daiConsenso } from "./actions";

// Al primo accesso (e se l'informativa cambia) si chiede il consenso esplicito (SPEC §8.2).
export default function PaginaConsenso() {
  const t = useTranslations("consenso");
  const [stato, azione, inCorso] = useActionState(daiConsenso, undefined);

  return (
    <PaginaAuth titolo={t("titolo")}>
      <form action={azione} className="space-y-4 text-sm">
        <Messaggio tipo="errore" testo={stato?.errore} />
        <p className="text-slate-600 dark:text-slate-300">
          {t("intro")}
        </p>
        <label className="flex items-start gap-2">
          <input type="checkbox" name="informativa" value="si" required className="mt-0.5" />
          <span>
            {t.rich("informativa", {
              link: (chunks) => (
                <Link href="/privacy" target="_blank" className="link">
                  {chunks}
                </Link>
              ),
            })}
          </span>
        </label>
        <label className="flex items-start gap-2">
          <input type="checkbox" name="salute" value="si" required className="mt-0.5" />
          <span>{t("salute")}</span>
        </label>
        <button type="submit" disabled={inCorso} className="bottone w-full">
          {inCorso ? t("inCorso") : t("conferma")}
        </button>
      </form>
      <form action={esci} className="text-center">
        <button type="submit" className="link text-sm">{t("rifiuta")}</button>
      </form>
    </PaginaAuth>
  );
}
