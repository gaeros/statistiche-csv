"use client";

import { useTranslations } from "next-intl";
import { useId, useRef, useState, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { Messaggio } from "@/components/Messaggio";

function BottoneConferma({ pronto, testo }: { pronto: boolean; testo: string }) {
  const t = useTranslations("confermaElimina");
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={!pronto || pending} className="bottone bg-red-600 hover:bg-red-700 disabled:opacity-50">
      {pending ? t("inCorso") : testo}
    </button>
  );
}

// Pulsante che apre una finestra modale: per eliminare bisogna scrivere ELIMINA (DELETE in inglese).
// L'azione sul server ricontrolla la parola con confermaScritta (src/lib/conferma.ts).
// Dialog nativo: tiene il focus al suo interno, Esc la chiude e il focus torna al pulsante.
export function ConfermaElimina({
  etichetta,
  titolo,
  avviso,
  conferma,
  azione,
  errore,
  classeApri = "text-red-600 hover:underline",
  children,
}: {
  etichetta: string;
  titolo: string;
  avviso: string;
  conferma: string;
  azione: (formData: FormData) => void | Promise<void>;
  errore?: string;
  classeApri?: string;
  children?: ReactNode;
}) {
  const t = useTranslations("confermaElimina");
  const finestra = useRef<HTMLDialogElement>(null);
  const id = useId();
  const [scritto, setScritto] = useState("");
  const pronto = scritto.trim() === t("parola");

  return (
    <>
      <button type="button" className={classeApri} onClick={() => finestra.current?.showModal()}>
        {etichetta}
      </button>
      <dialog
        ref={finestra}
        onClose={() => setScritto("")}
        onClick={(e) => e.target === e.currentTarget && finestra.current?.close()}
        aria-labelledby={`${id}-titolo`}
        aria-describedby={`${id}-avviso`}
        className="m-auto w-[min(28rem,calc(100vw-2rem))] rounded-3xl bg-white p-6 text-left text-base font-normal text-foreground backdrop:bg-black/55"
      >
        <form action={azione} className="space-y-4">
          {children}
          <h2 id={`${id}-titolo`} className="text-lg font-semibold text-red-700">{titolo}</h2>
          <p id={`${id}-avviso`} className="text-sm">{avviso}</p>
          <Messaggio tipo="errore" testo={errore} />
          <label className="block space-y-1 text-sm">
            <span>{t.rich("scrivi", { parola: t("parola"), b: (chunks) => <b>{chunks}</b> })}</span>
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
            <BottoneConferma pronto={pronto} testo={conferma} />
          </div>
        </form>
      </dialog>
    </>
  );
}
