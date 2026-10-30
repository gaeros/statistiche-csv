"use client";

import { useLocale, useTranslations } from "next-intl";
import { startTransition, useActionState, useState } from "react";
import { Messaggio } from "@/components/Messaggio";
import { creaFormati } from "@/lib/formato";
import { FORMATI_DATA, FORMATI_DECIMALI, type FormatoData, type FormatoDecimali, type Preferenze } from "@/lib/preferenze";
import { salvaFormati } from "./actions";

// Data e ora e numero d'esempio per l'anteprima dei formati.
const ESEMPIO_DATA = "2026-10-27T06:30:00Z";
const ESEMPIO_NUMERO = 1234.5;
const NOME_DATA = { auto: "auto", "gg/mm/aaaa": "giornoMeseAnno", "mm/gg/aaaa": "meseGiornoAnno", "aaaa-mm-gg": "annoMeseGiorno" } as const;

export function FormFormati({ preferenze }: { preferenze: Preferenze }) {
  const t = useTranslations("account");
  const lingua = useLocale();
  const [stato, azione, inCorso] = useActionState(salvaFormati, undefined);
  const [data, setData] = useState<FormatoData>(preferenze.data);
  const [decimali, setDecimali] = useState<FormatoDecimali>(preferenze.decimali);
  const esempio = (p: Partial<Preferenze>) => creaFormati(lingua, { data, decimali, ...p });
  const f = esempio({});

  return (
    // Invio a mano: con action={azione} React svuoterebbe il modulo dopo il salvataggio e le tendine
    // tornerebbero a «Automatico» pur restando salvata la scelta giusta.
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const dati = new FormData(e.currentTarget);
        startTransition(() => azione(dati));
      }}
      className="space-y-3"
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block space-y-1 text-sm">
          <span className="font-medium">{t("formatoData")}</span>
          <select name="data" value={data} onChange={(e) => setData(e.target.value as FormatoData)} className="campo w-full py-1.5">
            {FORMATI_DATA.map((v) => (
              <option key={v} value={v}>
                {t(NOME_DATA[v], { esempio: esempio({ data: v }).data(ESEMPIO_DATA) })}
              </option>
            ))}
          </select>
        </label>
        <label className="block space-y-1 text-sm">
          <span className="font-medium">{t("formatoDecimali")}</span>
          <select
            name="decimali"
            value={decimali}
            onChange={(e) => setDecimali(e.target.value as FormatoDecimali)}
            className="campo w-full py-1.5"
          >
            {FORMATI_DECIMALI.map((v) => (
              <option key={v} value={v}>
                {t(v, { esempio: esempio({ decimali: v }).numero(ESEMPIO_NUMERO) })}
              </option>
            ))}
          </select>
        </label>
      </div>
      <p className="text-sm text-slate-500">
        {t("esempio", { data: f.dataOra(ESEMPIO_DATA), numero: f.numero(ESEMPIO_NUMERO) })}
      </p>
      <Messaggio tipo="ok" testo={stato?.ok} />
      <Messaggio tipo="errore" testo={stato?.errore} />
      <button type="submit" disabled={inCorso} className="bottone">
        {t("salvaFormati")}
      </button>
    </form>
  );
}
