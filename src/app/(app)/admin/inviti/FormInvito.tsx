"use client";

import { useActionState } from "react";
import { Messaggio } from "@/components/Messaggio";
import { invita } from "./actions";

export function FormInvito() {
  const [stato, azione, inCorso] = useActionState(invita, undefined);

  return (
    <form action={azione} className="scheda space-y-4">
      <h2 className="font-semibold">Invita una persona</h2>
      <Messaggio tipo="errore" testo={stato?.errore} />
      <Messaggio tipo="ok" testo={stato?.ok} />
      <div className="flex flex-col gap-3 sm:flex-row">
        <input name="email" type="email" required placeholder="nome@esempio.it" className="campo" />
        <button type="submit" disabled={inCorso} className="bottone shrink-0">
          {inCorso ? "Invio…" : "Invita"}
        </button>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input name="invia_email" type="checkbox" defaultChecked />
        Invia l&apos;email di invito (per scegliere una password). Senza email, la persona può
        registrarsi solo con Google.
      </label>
    </form>
  );
}
