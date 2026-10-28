"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { Messaggio } from "@/components/Messaggio";
import { invita } from "./actions";

export function FormInvito() {
  const t = useTranslations("inviti");
  const [stato, azione, inCorso] = useActionState(invita, undefined);

  return (
    <form action={azione} className="scheda space-y-4">
      <h2 className="font-semibold">{t("invitaPersona")}</h2>
      <Messaggio tipo="errore" testo={stato?.errore} />
      <Messaggio tipo="ok" testo={stato?.ok} />
      <div className="flex flex-col gap-3 sm:flex-row">
        <input name="email" type="email" required placeholder={t("segnaposto")} className="campo" />
        <button type="submit" disabled={inCorso} className="bottone shrink-0">
          {inCorso ? t("inCorso") : t("invita")}
        </button>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input name="invia_email" type="checkbox" defaultChecked />
        {t("inviaEmail")}
      </label>
    </form>
  );
}
