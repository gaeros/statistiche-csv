import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { notFound } from "next/navigation";
import { conParametri } from "@/lib/filtri";
import { createClient } from "@/lib/supabase/server";
import { Azioni } from "./Azioni";
import { BarraFiltri } from "./BarraFiltri";
import { filtriDataset } from "./filtri-dataset";
import { Intestazione } from "./Intestazione";
import { TabellaDati } from "./TabellaDati";
import { formatiUtente } from "@/lib/utente";

const PER_PAGINA = 50;

type Colonna = { nome: string; originale: string; tipo: string };

export default async function PaginaDettaglio({ params, searchParams }: PageProps<"/dataset/[id]">) {
  const { id } = await params;
  const t = await getTranslations("dettaglio");
  const f = await formatiUtente();
  const sp = await searchParams;
  const pagina = Math.max(1, Number(sp.pagina) || 1);
  const ordina = typeof sp.ordina === "string" ? sp.ordina : "id";
  const discendente = sp.dir === "desc";

  const supabase = await createClient();
  const { data: d } = await supabase
    .from("dataset")
    .select("id, nome, nome_originale, foglio, colonne, righe, avvisi, created_at")
    .eq("id", id)
    .maybeSingle();
  if (!d) notFound();

  const colonne = d.colonne as Colonna[];
  const { filtri, etichette, valori, queryFiltri, salvati: filtriSalvati } = await filtriDataset(supabase, id, colonne, sp);
  const { data: risultato, error } = await supabase.rpc("leggi_righe", {
    p_filtri: filtri,
    p_dataset: id,
    p_limite: PER_PAGINA,
    p_offset: (pagina - 1) * PER_PAGINA,
    p_ordina: ordina,
    p_discendente: discendente,
  });
  const totale: number = risultato?.totale ?? 0;
  const righe: Record<string, unknown>[] = risultato?.righe ?? [];
  const pagine = Math.max(1, Math.ceil(totale / PER_PAGINA));
  const avvisi = (d.avvisi as string[]) ?? [];

  const link = (modifiche: Record<string, string | number>) =>
    `/dataset/${id}${conParametri(sp, Object.fromEntries(Object.entries(modifiche).map(([k, v]) => [k, String(v)])))}`;

  return (
    <div className="space-y-6">
      <Intestazione
        id={d.id}
        nome={d.nome}
        nomeOriginale={d.nome_originale}
        foglio={d.foglio}
        createdAt={d.created_at}
        righe={d.righe}
        colonne={colonne.length}
        attiva="dati"
        query={queryFiltri}
      />

      <BarraFiltri
        id={id}
        percorso={`/dataset/${id}`}
        salvati={filtriSalvati}
        colonne={colonne}
        sp={sp}
        etichette={etichette}
        valori={valori}
        totale={totale}
        complessivo={d.righe}
      />

      {avvisi.length > 0 && (
        <details className="scheda text-sm">
          <summary className="cursor-pointer font-medium">{t("avvisi", { n: avvisi.length })}</summary>
          <ul className="mt-2 list-inside list-disc text-slate-600">
            {avvisi.map((a) => <li key={a}>{a}</li>)}
          </ul>
        </details>
      )}

      {error && <p className="text-red-600">{t("erroreRighe", { dettaglio: error.message })}</p>}

      <TabellaDati
        nome={d.nome}
        colonne={colonne}
        valori={valori}
        righe={righe}
        primaRiga={(pagina - 1) * PER_PAGINA + 1}
        totale={totale}
        ordina={ordina}
        discendente={discendente}
        hrefOrdina={(c, dir) => link({ ordina: c, dir, pagina: 1 })}
      />

      <nav className="flex flex-wrap items-center justify-between gap-3 text-sm">
        <span className="text-slate-500">
          {etichette.length > 0 && t("conFiltri", { n: f.numero(totale) })}{t("pagina", { pagina, pagine })}
        </span>
        <div className="flex flex-wrap gap-2">
          <a href={`/dataset/${id}/esporta${queryFiltri}`} className="bottone-secondario px-3 py-1" download>
            {etichette.length ? t("scaricaCsvFiltri") : t("scaricaCsv")}
          </a>
          <a href={`/dataset/${id}/excel${queryFiltri}`} className="bottone-secondario px-3 py-1" download>
            {etichette.length ? t("scaricaExcelFiltri") : t("scaricaExcel")}
          </a>
          {pagina > 1 && <Link href={link({ pagina: pagina - 1 })} className="bottone-secondario px-3 py-1">{t("precedente")}</Link>}
          {pagina < pagine && <Link href={link({ pagina: pagina + 1 })} className="bottone-secondario px-3 py-1">{t("successiva")}</Link>}
        </div>
      </nav>

      <Azioni id={d.id} nome={d.nome} />
    </div>
  );
}
