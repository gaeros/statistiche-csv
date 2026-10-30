import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { InstallaApp } from "@/components/InstallaApp";

const PASSI = [1, 2, 3, 4, 5, 6, 7, 8] as const;

export async function generateMetadata() {
  return { title: (await getTranslations("guidaPagina"))("metaTitolo") };
}

export default async function PaginaGuida() {
  const t = await getTranslations("guidaPagina");
  return (
    <div className="max-w-3xl space-y-6">
      <div className="space-y-1">
        <h1 className="text-3xl font-semibold tracking-normal">{t("titolo")}</h1>
        <p className="text-slate-600">{t("intro")}</p>
        <p className="text-slate-600">{t("accesso")}</p>
      </div>
      <ol className="space-y-4">
        {PASSI.map((n) => (
          <li key={n} className="scheda space-y-1">
            <h2 className="font-semibold">
              {n}. {t(`p${n}Titolo`)}
            </h2>
            <p className="text-slate-600">{t(`p${n}Testo`)}</p>
          </li>
        ))}
      </ol>
      <section className="scheda space-y-1">
        <h2 className="font-semibold">{t("aspettoTitolo")}</h2>
        <p className="text-slate-600">{t("aspettoTesto")}</p>
      </section>
      <section className="scheda space-y-1">
        <h2 className="font-semibold">{t("formatiTitolo")}</h2>
        <p className="text-slate-600">{t("formatiTesto")}</p>
      </section>
      <section className="scheda space-y-3">
        <div className="space-y-1">
          <h2 className="font-semibold">{t("appTitolo")}</h2>
          <p className="text-slate-600">{t("appTesto")}</p>
        </div>
        <InstallaApp />
      </section>
      <p className="text-sm text-slate-500">{t("nota")}</p>
      <Link href="/importa" className="bottone inline-flex">
        {t("inizia")}
      </Link>
    </div>
  );
}
