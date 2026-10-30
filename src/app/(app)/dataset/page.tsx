import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatiUtente } from "@/lib/utente";

export default async function PaginaDataset({ searchParams }: PageProps<"/dataset">) {
  const t = await getTranslations("elenco");
  const f = await formatiUtente();
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
        <div className="scheda text-slate-600">
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

      {elenco && elenco.length > 0 && (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {elenco.map((d) => (
            <li key={d.id}>
              <Link href={`/dataset/${d.id}`} className="scheda block h-full space-y-2 hover:border-foreground">
                <p className="font-mono font-medium break-all">{d.nome}</p>
                <p className="text-sm text-slate-500 break-all">
                  {d.nome_originale}
                  {d.foglio ? ` · ${t("foglio", { nome: d.foglio })}` : ""}
                </p>
                <p className="text-sm">
                  {t("righeColonne", { righe: f.numero(d.righe), colonne: (d.colonne as unknown[]).length })}
                </p>
                <p className="text-xs text-slate-500">{t("importatoIl", { data: f.dataOra(d.created_at) })}</p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
