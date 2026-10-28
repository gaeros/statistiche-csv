"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { useActionState } from "react";
import { Messaggio } from "@/components/Messaggio";
import { accedi, accediConGoogle } from "./actions";

export function FormAccesso({ errore, ok }: { errore?: string; ok?: string }) {
  const t = useTranslations("accedi");
  const [stato, azione, inCorso] = useActionState(accedi, undefined);

  return (
    <div className="space-y-6">
      <Messaggio tipo="errore" testo={stato?.errore ?? errore} />
      <Messaggio tipo="ok" testo={ok} />

      <form action={accediConGoogle}>
        <button type="submit" className="bottone-secondario w-full">
          <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5">
            <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.4h6.5a5.6 5.6 0 0 1-2.4 3.6v3h3.9c2.3-2.1 3.5-5.2 3.5-8.7z" />
            <path fill="#34A853" d="M12 24c3.2 0 6-1.1 8-2.9l-3.9-3c-1.1.7-2.5 1.2-4.1 1.2-3.1 0-5.8-2.1-6.7-5H1.3v3.1A12 12 0 0 0 12 24z" />
            <path fill="#FBBC05" d="M5.3 14.3a7.2 7.2 0 0 1 0-4.6V6.6h-4a12 12 0 0 0 0 10.8l4-3.1z" />
            <path fill="#EA4335" d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4A12 12 0 0 0 1.3 6.6l4 3.1c.9-2.9 3.6-4.9 6.7-4.9z" />
          </svg>
          {t("google")}
        </button>
      </form>

      <div className="flex items-center gap-3 text-xs text-slate-500">
        <span className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
        {t("oppureEmail")}
        <span className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
      </div>

      <form action={azione} className="space-y-4">
        <label className="block space-y-1">
          <span className="text-sm font-medium">{t("email")}</span>
          <input name="email" type="email" autoComplete="email" required className="campo" />
        </label>
        <label className="block space-y-1">
          <span className="text-sm font-medium">{t("password")}</span>
          <input name="password" type="password" autoComplete="current-password" required className="campo" />
        </label>
        <button type="submit" disabled={inCorso} className="bottone w-full">
          {inCorso ? t("inCorso") : t("invio")}
        </button>
      </form>

      <div className="space-y-2 text-center text-sm">
        <Link href="/password-dimenticata" className="link">
          {t("dimenticata")}
        </Link>
        <p className="text-slate-500">{t("soloInvito")}</p>
        <Link href="/benvenuto" className="block text-xs text-slate-500 hover:underline">
          {t("cosE")}
        </Link>
        <Link href="/privacy" className="block text-xs text-slate-500 hover:underline">
          {t("privacy")}
        </Link>
      </div>
    </div>
  );
}
