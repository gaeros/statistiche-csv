"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Messaggio } from "@/components/Messaggio";
import { PaginaAuth } from "@/components/PaginaAuth";
import { erroreAuth, type Traduttore } from "@/lib/errori-auth";
import { createClient } from "@/lib/supabase/client";

// Restituisce un messaggio di errore, oppure null se la sessione è stata creata.
async function completaAccesso(te: Traduttore): Promise<string | null> {
  const parametri = new URLSearchParams(window.location.hash.slice(1));
  const accesso = parametri.get("access_token");
  const rinnovo = parametri.get("refresh_token");
  if (!accesso || !rinnovo) {
    return erroreAuth(te, parametri.get("error_description") ?? parametri.get("error") ?? te("linkNonValidoOScaduto"));
  }
  const { error } = await createClient().auth.setSession({ access_token: accesso, refresh_token: rinnovo });
  return error ? erroreAuth(te, error.message) : null;
}

// Ritorno dal link dell'email di invito con il modello predefinito di Supabase:
// la sessione arriva nella parte dopo "#" dell'indirizzo, che solo il browser vede.
export default function PaginaBenvenuto() {
  const router = useRouter();
  const t = useTranslations("benvenutoAuth");
  const te = useTranslations("erroriAuth");
  const [errore, setErrore] = useState<string | null>(null);

  useEffect(() => {
    completaAccesso(te).then((esito) => {
      if (esito) setErrore(esito);
      else router.replace("/imposta-password");
    });
  }, [router, te]);

  return (
    <PaginaAuth titolo={t("titolo")}>
      {errore ? (
        <div className="space-y-4">
          <Messaggio tipo="errore" testo={errore} />
          <p className="text-center text-sm">
            <Link href="/accedi" className="link">{t("vaiAccesso")}</Link>
          </p>
        </div>
      ) : (
        <p className="text-center text-sm text-slate-500">{t("inCorso")}</p>
      )}
    </PaginaAuth>
  );
}
