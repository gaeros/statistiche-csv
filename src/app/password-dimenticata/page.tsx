"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { useActionState } from "react";
import { Messaggio } from "@/components/Messaggio";
import { PaginaAuth } from "@/components/PaginaAuth";
import { inviaRecupero } from "./actions";

export default function PaginaPasswordDimenticata() {
  const t = useTranslations("passwordDimenticata");
  const ta = useTranslations("accedi");
  const [stato, azione, inCorso] = useActionState(inviaRecupero, undefined);

  return (
    <PaginaAuth titolo={t("titolo")}>
      <form action={azione} className="space-y-4">
        <Messaggio tipo="errore" testo={stato?.errore} />
        <Messaggio tipo="ok" testo={stato?.ok} />
        <label className="block space-y-1">
          <span className="text-sm font-medium">{ta("email")}</span>
          <input name="email" type="email" autoComplete="email" required className="campo" />
        </label>
        <button type="submit" disabled={inCorso} className="bottone w-full">
          {inCorso ? t("inCorso") : t("invio")}
        </button>
        <p className="text-center text-sm">
          <Link href="/accedi" className="link">{t("torna")}</Link>
        </p>
      </form>
    </PaginaAuth>
  );
}
