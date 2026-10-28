import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { SelettoreLingua } from "@/components/SelettoreLingua";
import { VERSIONE_INFORMATIVA } from "@/lib/privacy";

export async function generateMetadata() {
  return { title: (await getTranslations("privacy"))("metaTitolo") };
}

// Bozza di informativa (SPEC §8.2): va fatta verificare da un esperto privacy prima di aprire l'app ad altri.
export default async function PaginaPrivacy() {
  const t = await getTranslations("privacy");
  const b = (chunks: React.ReactNode) => <b>{chunks}</b>;
  const [anno, mese, giorno] = VERSIONE_INFORMATIVA.split("-");
  const data = `${giorno}/${mese}/${anno}`;

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 space-y-6 px-4 py-10 text-slate-700 dark:text-slate-300 [&_h2]:mt-6 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-slate-900 dark:[&_h2]:text-slate-100 [&_li]:ml-5 [&_li]:list-disc">
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <Link href="/" className="link text-sm">← Datahue</Link>
          <SelettoreLingua />
        </div>
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">{t("titolo")}</h1>
        <p className="text-sm text-slate-500">{t("versione", { data })}</p>
      </div>

      <h2>{t("chiH")}</h2>
      <p>{t("chiP")}</p>

      <h2>{t("qualiH")}</h2>
      <ul>
        <li>{t("quali1")}</li>
        <li>{t.rich("quali2", { b })}</li>
        <li>{t("quali3")}</li>
      </ul>

      <h2>{t("perchéH")}</h2>
      <p>{t.rich("perchéP", { b })}</p>

      <h2>{t("chiVedeH")}</h2>
      <ul>
        <li>{t("chiVede1")}</li>
        <li>{t("chiVede2")}</li>
        <li>{t("chiVede3")}</li>
      </ul>

      <h2>{t("quantoH")}</h2>
      <p>{t("quantoP")}</p>

      <h2>{t("dirittiH")}</h2>
      <p>
        {t.rich("dirittiP", {
          account: (chunks) => (
            <Link href="/account" className="link">
              {chunks}
            </Link>
          ),
        })}
      </p>

      <h2>{t("medicoH")}</h2>
      <p>{t("medicoP")}</p>
    </main>
  );
}
