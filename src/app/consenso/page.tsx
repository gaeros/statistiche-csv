"use client";

import Link from "next/link";
import { useActionState } from "react";
import { esci } from "@/app/accedi/actions";
import { Messaggio } from "@/components/Messaggio";
import { PaginaAuth } from "@/components/PaginaAuth";
import { daiConsenso } from "./actions";

// Al primo accesso (e se l'informativa cambia) si chiede il consenso esplicito (SPEC §8.2).
export default function PaginaConsenso() {
  const [stato, azione, inCorso] = useActionState(daiConsenso, undefined);

  return (
    <PaginaAuth titolo="Prima di iniziare">
      <form action={azione} className="space-y-4 text-sm">
        <Messaggio tipo="errore" testo={stato?.errore} />
        <p className="text-slate-600 dark:text-slate-300">
          I file che carichi possono contenere dati sulla salute, come pressione e battiti. Restano visibili solo a te e sono
          conservati in Europa.
        </p>
        <label className="flex items-start gap-2">
          <input type="checkbox" name="informativa" value="si" required className="mt-0.5" />
          <span>
            Ho letto l&apos;
            <Link href="/privacy" target="_blank" className="link">informativa sul trattamento dei dati</Link>.
          </span>
        </label>
        <label className="flex items-start gap-2">
          <input type="checkbox" name="salute" value="si" required className="mt-0.5" />
          <span>Acconsento al trattamento dei dati relativi alla mia salute che caricherò nell&apos;app.</span>
        </label>
        <button type="submit" disabled={inCorso} className="bottone w-full">
          {inCorso ? "Salvataggio…" : "Accetto e continuo"}
        </button>
      </form>
      <form action={esci} className="text-center">
        <button type="submit" className="link text-sm">Non accetto, esci</button>
      </form>
    </PaginaAuth>
  );
}
