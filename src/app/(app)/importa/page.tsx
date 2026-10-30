import { getTranslations } from "next-intl/server";
import { Importatore } from "./Importatore";

export async function generateMetadata() {
  return { title: `${(await getTranslations("importa"))("titolo")} – Datahue` };
}

export default async function PaginaImporta() {
  const t = await getTranslations("importa");
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-3xl font-semibold tracking-normal">{t("titolo")}</h1>
        <p className="text-slate-600">
          {t("sottotitolo")}
        </p>
      </div>
      <Importatore />
    </div>
  );
}
