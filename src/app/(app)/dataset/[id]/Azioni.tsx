"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { ConfermaElimina } from "@/components/ConfermaElimina";
import { Messaggio } from "@/components/Messaggio";
import { elimina, rinomina } from "./actions";

export function Azioni({ id, nome }: { id: string; nome: string }) {
  const t = useTranslations("dettaglio");
  const [stato, azione, inCorso] = useActionState(rinomina.bind(null, id), undefined);

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

        <ConfermaElimina
          etichetta={t("eliminaPuntini")}
          titolo={t("eliminaTitolo", { nome })}
          avviso={t("eliminaAvviso")}
          conferma={t("eliminaConferma")}
          azione={elimina.bind(null, id)}
        />
      </div>
    </details>
  );
}
