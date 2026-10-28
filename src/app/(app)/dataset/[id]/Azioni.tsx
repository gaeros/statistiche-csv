"use client";

import { useTranslations } from "next-intl";
import { useActionState, useState } from "react";
import { Messaggio } from "@/components/Messaggio";
import { elimina, rinomina } from "./actions";

export function Azioni({ id, nome }: { id: string; nome: string }) {
  const t = useTranslations("dettaglio");
  const [stato, azione, inCorso] = useActionState(rinomina.bind(null, id), undefined);
  const [conferma, setConferma] = useState(false);

  return (
    <details className="scheda">
      <summary className="cursor-pointer font-medium">{t("rinominaOElimina")}</summary>
      <div className="mt-4 space-y-6">
        <form action={azione} className="space-y-2">
          <Messaggio tipo="errore" testo={stato?.errore} />
          <Messaggio tipo="ok" testo={stato?.ok} />
          <label className="block space-y-1">
            <span className="text-sm font-medium">{t("nomeMostrato")}</span>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input name="nome" defaultValue={nome} maxLength={100} required className="campo" />
              <button type="submit" disabled={inCorso} className="bottone-secondario shrink-0">
                {t("rinomina")}
              </button>
            </div>
          </label>
        </form>

        <div className="space-y-2">
          {!conferma ? (
            <button type="button" className="text-red-600 hover:underline dark:text-red-400" onClick={() => setConferma(true)}>
              {t("eliminaPuntini")}
            </button>
          ) : (
            <form action={elimina.bind(null, id)} className="space-y-2 rounded-md border border-red-300 p-3 dark:border-red-900">
              <p className="text-sm">
                {t("eliminaAvviso")}
              </p>
              <div className="flex gap-2">
                <button type="submit" className="bottone bg-red-600 hover:bg-red-700">{t("eliminaConferma")}</button>
                <button type="button" className="bottone-secondario" onClick={() => setConferma(false)}>{t("annulla")}</button>
              </div>
            </form>
          )}
        </div>
      </div>
    </details>
  );
}
