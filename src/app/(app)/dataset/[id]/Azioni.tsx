"use client";

import { useTranslations } from "next-intl";
import { useActionState, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { Messaggio } from "@/components/Messaggio";
import { elimina, rinomina } from "./actions";

function BottoneConferma({ pronto }: { pronto: boolean }) {
  const t = useTranslations("dettaglio");
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={!pronto || pending} className="bottone bg-red-600 hover:bg-red-700 disabled:opacity-50">
      {pending ? t("eliminaInCorso") : t("eliminaConferma")}
    </button>
  );
}

export function Azioni({ id, nome }: { id: string; nome: string }) {
  const t = useTranslations("dettaglio");
  const [stato, azione, inCorso] = useActionState(rinomina.bind(null, id), undefined);
  const finestra = useRef<HTMLDialogElement>(null);
  const [scritto, setScritto] = useState("");
  const pronto = scritto.trim() === t("parola");

  return (
    <>
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

          <button type="button" className="text-red-600 hover:underline dark:text-red-400" onClick={() => finestra.current?.showModal()}>
            {t("eliminaPuntini")}
          </button>
        </div>
      </details>
      {/* Finestra modale nativa: tiene il focus al suo interno, Esc la chiude e il focus torna al pulsante. */}
      <dialog
        ref={finestra}
        onClose={() => setScritto("")}
        onClick={(e) => e.target === e.currentTarget && finestra.current?.close()}
        aria-labelledby="elimina-titolo"
        aria-describedby="elimina-avviso"
        className="m-auto w-[min(28rem,calc(100vw-2rem))] rounded-3xl bg-white p-6 text-foreground backdrop:bg-slate-950/50 dark:bg-slate-900"
      >
        <form action={elimina.bind(null, id)} className="space-y-4">
          <h2 id="elimina-titolo" className="text-lg font-semibold text-red-700 dark:text-red-400">{t("eliminaTitolo", { nome })}</h2>
          <p id="elimina-avviso" className="text-sm">{t("eliminaAvviso")}</p>
          <label className="block space-y-1 text-sm">
            <span>{t.rich("eliminaScrivi", { parola: t("parola"), b: (chunks) => <b>{chunks}</b> })}</span>
            <input
              name="conferma"
              value={scritto}
              onChange={(e) => setScritto(e.target.value)}
              autoFocus
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              className="campo"
            />
          </label>
          <div className="flex flex-wrap justify-end gap-2">
            <button type="button" className="bottone-secondario" onClick={() => finestra.current?.close()}>{t("annulla")}</button>
            <BottoneConferma pronto={pronto} />
          </div>
        </form>
      </dialog>
    </>
  );
}
