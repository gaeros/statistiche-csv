import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { ElencoDataset } from "@/components/ElencoDataset";
import { createClient } from "@/lib/supabase/server";

export default async function PaginaDataset({ searchParams }: PageProps<"/dataset">) {
  const t = await getTranslations("elenco");
  const { q } = await searchParams;
  const ricerca = typeof q === "string" ? q.trim() : "";

  const supabase = await createClient();
  let query = supabase
    .from("dataset")
    .select("id, nome, nome_originale, foglio, righe, colonne, created_at")
    .order("created_at", { ascending: false });
  if (ricerca) {
    const filtro = ricerca.replace(/[%_,()]/g, " ");
    query = query.or(`nome.ilike.%${filtro}%,nome_originale.ilike.%${filtro}%`);
  }
  const { data: elenco, error } = await query;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-semibold tracking-normal">{t("titolo")}</h1>
        <Link href="/importa" className="bottone">
          {t("importaFile")}
        </Link>
      </div>

      <form className="flex gap-2">
        <input name="q" defaultValue={ricerca} placeholder={t("cerca")} className="campo max-w-sm" />
        <button type="submit" className="bottone-secondario">{t("cercaBtn")}</button>
      </form>

      {error && <p className="text-red-600">{t("errore", { dettaglio: error.message })}</p>}

      {elenco && elenco.length === 0 && (
        <div className="scheda text-slate-600 dark:text-slate-300">
          {ricerca ? (
            t("nessunRisultato")
          ) : (
            <>
              {t("vuoto")}{" "}
              <Link href="/importa" className="link">{t("importaPrimo")}</Link>.
            </>
          )}
        </div>
      )}

      {elenco && elenco.length > 0 && <ElencoDataset elenco={elenco} />}
    </div>
  );
}
