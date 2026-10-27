"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Messaggio } from "@/components/Messaggio";
import { PaginaAuth } from "@/components/PaginaAuth";
import { inviaRecupero } from "./actions";

export default function PaginaPasswordDimenticata() {
  const [stato, azione, inCorso] = useActionState(inviaRecupero, undefined);

  return (
    <PaginaAuth titolo="Password dimenticata">
      <form action={azione} className="space-y-4">
        <Messaggio tipo="errore" testo={stato?.errore} />
        <Messaggio tipo="ok" testo={stato?.ok} />
        <label className="block space-y-1">
          <span className="text-sm font-medium">Email</span>
          <input name="email" type="email" autoComplete="email" required className="campo" />
        </label>
        <button type="submit" disabled={inCorso} className="bottone w-full">
          {inCorso ? "Invio…" : "Inviami il link"}
        </button>
        <p className="text-center text-sm">
          <Link href="/accedi" className="link">Torna all&apos;accesso</Link>
        </p>
      </form>
    </PaginaAuth>
  );
}
