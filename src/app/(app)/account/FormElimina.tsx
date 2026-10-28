"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { Messaggio } from "@/components/Messaggio";
import { eliminaAccount } from "./actions";

export function FormElimina() {
  const t = useTranslations("account");
  const [stato, azione, inCorso] = useActionState(eliminaAccount, undefined);
  return (
    <form action={azione} className="space-y-3">
      <Messaggio tipo="errore" testo={stato?.errore} />
      <label className="block max-w-xs space-y-1 text-sm">
        <span>{t.rich("confermaScrivi", { parola: t("parola"), b: (chunks) => <b>{chunks}</b> })}</span>
        <input name="conferma" autoComplete="off" required className="campo py-1.5" />
      </label>
      <button
        type="submit"
        disabled={inCorso}
        className="inline-flex items-center rounded-md bg-red-600 px-4 py-2 font-medium text-white hover:bg-red-700 disabled:opacity-60"
      >
        {inCorso ? t("inCorso") : t("elimina")}
      </button>
    </form>
  );
}
