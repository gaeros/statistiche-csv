"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { ConfermaElimina } from "@/components/ConfermaElimina";
import { eliminaAccount } from "./actions";

// Usato nella pagina Il mio account e nel menu dell'account della barra in alto.
export function FormElimina({ etichetta, classeApri }: { etichetta?: string; classeApri?: string } = {}) {
  const t = useTranslations("account");
  const [stato, azione] = useActionState(eliminaAccount, undefined);
  return (
    <ConfermaElimina
      etichetta={etichetta ?? t("eliminaApri")}
      titolo={t("eliminaTitolo")}
      avviso={t("eliminaP")}
      conferma={t("elimina")}
      azione={azione}
      errore={stato?.errore}
      classeApri={classeApri ?? "inline-flex items-center rounded-md bg-red-600 px-4 py-2 font-medium text-white hover:bg-red-700"}
    />
  );
}
