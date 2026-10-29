"use client";

import { useTranslations } from "next-intl";
import { ConfermaElimina } from "@/components/ConfermaElimina";
import { eliminaPersona } from "./actions";

export function BottoneElimina({ email }: { email: string }) {
  const t = useTranslations("inviti");
  return (
    <ConfermaElimina
      etichetta={t("elimina")}
      titolo={t("eliminaTitolo", { email })}
      avviso={t("eliminaAvviso")}
      conferma={t("eliminaConferma")}
      azione={eliminaPersona}
    >
      <input type="hidden" name="email" value={email} />
    </ConfermaElimina>
  );
}
