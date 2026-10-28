"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { Messaggio } from "@/components/Messaggio";
import { PaginaAuth } from "@/components/PaginaAuth";
import { GOOGLE_ATTIVO } from "@/lib/funzioni";
import { impostaPassword } from "./actions";

// Si arriva qui dal link dell'invito o del recupero password, già collegati.
export default function PaginaImpostaPassword() {
  const t = useTranslations("impostaPassword");
  const [stato, azione, inCorso] = useActionState(impostaPassword, undefined);

  return (
    <PaginaAuth titolo={t("titolo")}>
      <form action={azione} className="space-y-4">
        <Messaggio tipo="errore" testo={stato?.errore} />
        <label className="block space-y-1">
          <span className="text-sm font-medium">{t("nuova")}</span>
          <input name="password" type="password" autoComplete="new-password" minLength={8} required className="campo" />
        </label>
        <label className="block space-y-1">
          <span className="text-sm font-medium">{t("ripeti")}</span>
          <input name="conferma" type="password" autoComplete="new-password" minLength={8} required className="campo" />
        </label>
        <button type="submit" disabled={inCorso} className="bottone w-full">
          {inCorso ? t("inCorso") : t("salva")}
        </button>
        {GOOGLE_ATTIVO && <p className="text-center text-xs text-slate-500">{t("google")}</p>}
      </form>
    </PaginaAuth>
  );
}
