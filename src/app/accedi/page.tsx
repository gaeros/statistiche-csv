import { getTranslations } from "next-intl/server";
import { PaginaAuth } from "@/components/PaginaAuth";
import { FormAccesso } from "./FormAccesso";

export default async function PaginaAccedi({ searchParams }: PageProps<"/accedi">) {
  const { errore, ok, eliminato } = await searchParams;
  const t = await getTranslations("accedi");
  return (
    <PaginaAuth titolo={t("titolo")}>
      <FormAccesso
        errore={typeof errore === "string" ? errore : undefined}
        ok={eliminato ? t("eliminato") : typeof ok === "string" ? ok : undefined}
      />
    </PaginaAuth>
  );
}
