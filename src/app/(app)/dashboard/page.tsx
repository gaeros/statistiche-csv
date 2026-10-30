import { getLocale, getTranslations } from "next-intl/server";
import Link from "next/link";
import { GraficoLibero } from "@/components/grafici/GraficoLibero";
import { ScegliDataset } from "@/components/ScegliDataset";
import { SchedeRiordinabili } from "@/components/SchedeRiordinabili";
import { DASHBOARD } from "@/lib/condivisioni";
import { conParametri, type Colonna } from "@/lib/filtri";
import { creaFormati } from "@/lib/formato";
import { leggiConfigurazione, parametriConfigurazione, prepara, type Configurazione } from "@/lib/grafici";
import { createClient } from "@/lib/supabase/server";
import { salvaOrdineDashboard, togliDallaDashboard } from "./actions";

type GraficoSalvato = {
  id: string;
  titolo: string;
  configurazione: Configurazione;
  dataset_id: string;
  dataset: { nome: string; colonne: Colonna[] } | null;
};

// Dashboard personale: i grafici salvati che l'utente ha fissato, da tutti i suoi dataset,
// nell'ordine scelto da lui (trascinamento, tastiera, lente come in «Colonna per colonna»).
// I grafici si calcolano su tutte le righe: i filtri valgono solo nella pagina del dataset.
// In alto una ricerca compatta (solo i nomi) apre i grafici di un dataset: lo spazio resta ai grafici.
export default async function PaginaDashboard() {
  const t = await getTranslations("dashboard");
  const tg = await getTranslations("grafici");
  const tc = await getTranslations("chart");
  const f = creaFormati(await getLocale());

  const supabase = await createClient();
  const [{ data: elenco, error: errDataset }, { data: riga, error }] = await Promise.all([
    supabase
      .from("dataset")
      .select("id, nome")
      .order("nome"),
    supabase.from("dashboard").select("grafici").maybeSingle(),
  ]);
  const ids = (riga?.grafici as string[] | undefined) ?? [];

  const { data: trovati, error: errGrafici } = ids.length
    ? await supabase.from("grafici").select("id, titolo, configurazione, dataset_id, dataset(nome, colonne)").in("id", ids)
    : { data: [], error: null };
  const perId = new Map(((trovati ?? []) as unknown as GraficoSalvato[]).map((g) => [g.id, g]));
  const fissati = ids.flatMap((id) => perId.get(id) ?? []);

  const schede = await Promise.all(
    fissati.map(async (g) => {
      const colonne = g.dataset?.colonne ?? [];
      const c = leggiConfigurazione(parametriConfigurazione(g.configurazione), colonne);
      const { data, error: e } = await supabase.rpc("dati_grafico", { p_dataset: g.dataset_id, p_config: c, p_filtri: [] });
      return {
        chiave: g.id,
        nome: g.titolo,
        contenuto: (
          <article className="scheda min-w-0 space-y-3">
            {/* pr-10: a destra c'è il pulsante per ingrandire la scheda */}
            <header className="space-y-0.5 pr-10">
              <h2 className="font-semibold">{g.titolo}</h2>
              <p className="text-sm text-slate-500 break-all">{t("daDataset", { nome: g.dataset?.nome ?? "" })}</p>
            </header>
            {e && <p className="text-sm text-red-600">{e.message}</p>}
            {data && <GraficoLibero titolo={g.titolo} preparato={prepara(c, data, colonne, f, tg)} altezza={300} sottotitolo={tc("sottotitoloTutte", { nome: g.dataset?.nome ?? "" })} />}
            <footer className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-slate-100 pt-3 text-sm">
              <Link href={`/dataset/${g.dataset_id}/grafici${conParametri({}, parametriConfigurazione(c))}#costruttore`} className="link">
                {t("apriDataset")}
              </Link>
              <form action={togliDallaDashboard.bind(null, g.id)}>
                <button type="submit" className="link" title={t("togliAiuto")}>{t("togli")}</button>
              </form>
            </footer>
          </article>
        ),
      };
    }),
  );

  const intestazione = (
    <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
      <div>
        <h1 className="text-3xl font-semibold tracking-normal">{t("titolo")}</h1>
        {schede.length > 0 && (
          <p className="text-sm text-slate-500">
            {t("sottotitolo")} {t("senzaFiltri")}
          </p>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {elenco && elenco.length > 0 && (
          <ScegliDataset
            voci={elenco}
            etichetta={t("cercaEtichetta")}
            segnaposto={t("cercaDataset")}
            apri={t("apriGrafici")}
            nessuno={t("nessunRisultato")}
          />
        )}
        {schede.length > 0 && (
          <Link href={`/condivisioni?grafico=${DASHBOARD}`} className="bottone-secondario py-2 text-sm" title={t("condividiAiuto")}>
            {t("condividi")}
          </Link>
        )}
      </div>
      {errDataset && <p className="w-full text-red-600">{t("errore", { dettaglio: errDataset.message })}</p>}
    </div>
  );

  const errore = error ?? errGrafici;
  let grafici;
  if (errore) {
    grafici = (
      <div className="space-y-6">
        {intestazione}
        <p className="text-red-600">{t("errore", { dettaglio: errore.message })}</p>
      </div>
    );
  } else if (schede.length === 0) {
    grafici = (
      <div className="space-y-6">
        {intestazione}
        <div className="scheda space-y-2">
          <h2 className="text-xl font-semibold">{t("vuotaTitolo")}</h2>
          <p className="text-slate-600">{elenco && elenco.length === 0 ? t("nessunDataset") : t("vuota")}</p>
          {elenco && elenco.length === 0 && <Link href="/importa" className="bottone">{t("importaPrimo")}</Link>}
        </div>
      </div>
    );
  } else {
    grafici = (
      <SchedeRiordinabili
        voci={schede}
        salvato={fissati.map((g) => g.id)}
        intestazione={intestazione}
        salva={salvaOrdineDashboard}
        ripristinabile={false}
        griglia="lg:grid-cols-2"
      />
    );
  }

  return <div className="space-y-4">{grafici}</div>;
}
