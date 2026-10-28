import { getTranslations } from "next-intl/server";
import { Importatore } from "./Importatore";

export default async function PaginaImporta() {
  const t = await getTranslations("importa");
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-3xl font-semibold tracking-tight">{t("titolo")}</h1>
        <p className="text-slate-600 dark:text-slate-400">
          {t("sottotitolo")}
        </p>
      </div>
      <Importatore />
    </div>
  );
}
