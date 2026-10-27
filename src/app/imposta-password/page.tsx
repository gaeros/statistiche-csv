"use client";

import { useActionState } from "react";
import { Messaggio } from "@/components/Messaggio";
import { PaginaAuth } from "@/components/PaginaAuth";
import { impostaPassword } from "./actions";

// Si arriva qui dal link dell'invito o del recupero password, già collegati.
export default function PaginaImpostaPassword() {
  const [stato, azione, inCorso] = useActionState(impostaPassword, undefined);

  return (
    <PaginaAuth titolo="Scegli la password">
      <form action={azione} className="space-y-4">
        <Messaggio tipo="errore" testo={stato?.errore} />
        <label className="block space-y-1">
          <span className="text-sm font-medium">Nuova password</span>
          <input name="password" type="password" autoComplete="new-password" minLength={8} required className="campo" />
        </label>
        <label className="block space-y-1">
          <span className="text-sm font-medium">Ripeti la password</span>
          <input name="conferma" type="password" autoComplete="new-password" minLength={8} required className="campo" />
        </label>
        <button type="submit" disabled={inCorso} className="bottone w-full">
          {inCorso ? "Salvataggio…" : "Salva e continua"}
        </button>
        <p className="text-center text-xs text-slate-500">
          In alternativa puoi sempre entrare con Google, se usi lo stesso indirizzo email.
        </p>
      </form>
    </PaginaAuth>
  );
}
