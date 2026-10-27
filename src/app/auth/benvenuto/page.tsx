"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Messaggio } from "@/components/Messaggio";
import { PaginaAuth } from "@/components/PaginaAuth";
import { erroreAuth } from "@/lib/errori-auth";
import { createClient } from "@/lib/supabase/client";

// Restituisce un messaggio di errore, oppure null se la sessione è stata creata.
async function completaAccesso(): Promise<string | null> {
  const parametri = new URLSearchParams(window.location.hash.slice(1));
  const accesso = parametri.get("access_token");
  const rinnovo = parametri.get("refresh_token");
  if (!accesso || !rinnovo) {
    return erroreAuth(parametri.get("error_description") ?? parametri.get("error") ?? "Link non valido o scaduto.");
  }
  const { error } = await createClient().auth.setSession({ access_token: accesso, refresh_token: rinnovo });
  return error ? erroreAuth(error.message) : null;
}

// Ritorno dal link dell'email di invito con il modello predefinito di Supabase:
// la sessione arriva nella parte dopo "#" dell'indirizzo, che solo il browser vede.
export default function PaginaBenvenuto() {
  const router = useRouter();
  const [errore, setErrore] = useState<string | null>(null);

  useEffect(() => {
    completaAccesso().then((esito) => {
      if (esito) setErrore(esito);
      else router.replace("/imposta-password");
    });
  }, [router]);

  return (
    <PaginaAuth titolo="Benvenuto">
      {errore ? (
        <div className="space-y-4">
          <Messaggio tipo="errore" testo={errore} />
          <p className="text-center text-sm">
            <Link href="/accedi" className="link">Vai all&apos;accesso</Link>
          </p>
        </div>
      ) : (
        <p className="text-center text-sm text-slate-500">Accesso in corso…</p>
      )}
    </PaginaAuth>
  );
}
