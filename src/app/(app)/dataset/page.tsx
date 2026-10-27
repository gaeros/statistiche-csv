import Link from "next/link";
import { formattaDataOra, formattaNumero } from "@/lib/formato";
import { createClient } from "@/lib/supabase/server";

export default async function PaginaDataset({ searchParams }: PageProps<"/dataset">) {
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
        <h1 className="text-2xl font-semibold">I miei dataset</h1>
        <Link href="/importa" className="bottone">
          Importa file
        </Link>
      </div>

      <form className="flex gap-2">
        <input name="q" defaultValue={ricerca} placeholder="Cerca per nome o file…" className="campo max-w-sm" />
        <button type="submit" className="bottone-secondario">Cerca</button>
      </form>

      {error && <p className="text-red-600">Impossibile leggere i dataset: {error.message}</p>}

      {elenco && elenco.length === 0 && (
        <div className="scheda text-slate-600 dark:text-slate-300">
          {ricerca ? (
            "Nessun dataset corrisponde alla ricerca."
          ) : (
            <>
              Non hai ancora dataset.{" "}
              <Link href="/importa" className="link">Importa il primo file</Link>.
            </>
          )}
        </div>
      )}

      {elenco && elenco.length > 0 && (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {elenco.map((d) => (
            <li key={d.id}>
              <Link href={`/dataset/${d.id}`} className="scheda block h-full space-y-2 hover:border-blue-400">
                <p className="font-mono font-medium break-all">{d.nome}</p>
                <p className="text-sm text-slate-500 break-all">
                  {d.nome_originale}
                  {d.foglio ? ` · foglio ${d.foglio}` : ""}
                </p>
                <p className="text-sm">
                  {formattaNumero(d.righe)} righe · {(d.colonne as unknown[]).length} colonne
                </p>
                <p className="text-xs text-slate-500">Importato il {formattaDataOra(d.created_at)}</p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
