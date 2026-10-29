"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { ConfermaElimina } from "@/components/ConfermaElimina";
import { eliminaAccount } from "./actions";

export function FormElimina() {
  const t = useTranslations("account");
  const [stato, azione] = useActionState(eliminaAccount, undefined);
  return (
    <ConfermaElimina
      etichetta={t("eliminaApri")}
      titolo={t("eliminaTitolo")}
      avviso={t("eliminaP")}
      conferma={t("elimina")}
      azione={azione}
      errore={stato?.errore}
      classeApri="inline-flex items-center rounded-md bg-red-600 px-4 py-2 font-medium text-white hover:bg-red-700"
    />
  );
}
