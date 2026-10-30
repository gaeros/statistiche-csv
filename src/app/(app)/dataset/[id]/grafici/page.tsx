import { getLocale, getTranslations } from "next-intl/server";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CampiNascosti } from "@/components/CampiNascosti";
import { FormPulito } from "@/components/FormPulito";
import { GraficoLibero } from "@/components/grafici/GraficoLibero";
import { creaFormati } from "@/lib/formato";
import { conParametri, leggiFiltri, type Colonna } from "@/lib/filtri";
import {
  AGGREGAZIONI,
  colonneAdatte,
  leggiConfigurazione,
  parametriConfigurazione,
  PERIODI,
  prepara,
  TIPI,
  titoloAutomatico,
  type Configurazione,
} from "@/lib/grafici";
import { createClient } from "@/lib/supabase/server";
import { BarraFiltri } from "../BarraFiltri";
import { filtriDataset } from "../filtri-dataset";
import { Intestazione } from "../Intestazione";
import { ConfermaElimina } from "@/components/ConfermaElimina";
import { eliminaGrafico, fissaInDashboard, salvaGrafico } from "./actions";

const SERIE = ["barre", "barre_impilate", "linee", "area"];

function Campo({ etichetta, children }: { etichetta: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1 text-sm">
      <span className="block font-medium">{etichetta}</span>
      {children}
    </label>
  );
}

function Opzioni({ elenco, vuota }: { elenco: { valore: string; etichetta: string }[]; vuota?: string }) {
  return (
    <>
      {vuota && <option value="">{vuota}</option>}
      {elenco.map((o) => (
        <option key={o.valore} value={o.valore}>
          {o.etichetta}
        </option>
      ))}
    </>
  );
}

export default async function PaginaGrafici({ params, searchParams }: PageProps<"/dataset/[id]/grafici">) {
  const { id } = await params;
  const t = await getTranslations("graficiPagina");
  const tg = await getTranslations("grafici");
  const tc = await getTranslations("chart");
  const f = creaFormati(await getLocale());
  const sp = await searchParams;

  const supabase = await createClient();
  const { data: d } = await supabase
    .from("dataset")
    .select("id, nome, nome_originale, foglio, colonne, righe, created_at")
    .eq("id", id)
    .maybeSingle();
  if (!d) notFound();

  const colonne = d.colonne as Colonna[];
  const { filtri } = leggiFiltri(sp, colonne);
  const config = leggiConfigurazione(sp, colonne);

  const [{ etichette, valori, queryFiltri }, { data: salvati }, anteprima, { data: pannello }] = await Promise.all([
    filtriDataset(supabase, id, colonne, sp),
    supabase.from("grafici").select("id, titolo, configurazione").eq("dataset_id", id).order("created_at"),
    supabase.rpc("dati_grafico", { p_dataset: id, p_config: config, p_filtri: filtri }),
    supabase.from("dashboard").select("grafici").maybeSingle(),
  ]);
  const fissati = new Set((pannello?.grafici as string[] | undefined) ?? []);

  // I grafici salvati si ricalcolano con i filtri attivi; la configurazione si ricontrolla sulle colonne attuali.
  const dashboard = await Promise.all(
    (salvati ?? []).map(async (g) => {
      const c = leggiConfigurazione(parametriConfigurazione(g.configurazione as Configurazione), colonne);
      const { data, error } = await supabase.rpc("dati_grafico", { p_dataset: id, p_config: c, p_filtri: filtri });
      return { id: g.id as string, titolo: g.titolo as string, config: c, preparato: data ? prepara(c, data, colonne, f, tg) : null, errore: error?.message };
    }),
  );

  const adatte = colonneAdatte(config.tipo, colonne);
  const opz = (l: Colonna[]) => l.map((c) => ({ valore: c.nome, etichetta: c.originale }));
  const serie = SERIE.includes(config.tipo);
  const unaSola = !serie;
  const xData = colonne.some((c) => c.nome === config.x && (c.tipo === "data" || c.tipo === "data_ora"));
  const titolo = titoloAutomatico(config, colonne, tg);
  const ritorno = conParametri(sp, {});
  // Nei PNG e PDF esportati: da quale dataset vengono i dati e con quali filtri.
  const sottotitolo = etichette.length
    ? tc("sottotitoloFiltri", { nome: d.nome, filtri: etichette.map((e) => e.testo).join("; ") })
    : tc("sottotitoloTutte", { nome: d.nome });

  return (
    <div className="space-y-8">
      <Intestazione
        id={d.id}
        nome={d.nome}
        nomeOriginale={d.nome_originale}
        foglio={d.foglio}
        createdAt={d.created_at}
        righe={d.righe}
        colonne={colonne.length}
        attiva="grafici"
        query={queryFiltri}
      />

      <BarraFiltri colonne={colonne} sp={sp} etichette={etichette} valori={valori} />

      {/* Grafici salvati per questo dataset (si possono fissare nella dashboard personale) */}
      <section id="dashboard" className="space-y-4">
        <div>
          <h2 className="text-xl font-semibold">{t("dashboard")}</h2>
          <p className="text-sm text-slate-500">
            {dashboard.length
              ? t("dashboardPiena")
              : t("dashboardVuota")}
          </p>
        </div>
        {dashboard.length > 0 && (
          <div className="grid gap-4 lg:grid-cols-2">
            {dashboard.map((g) => (
              <article key={g.id} className="scheda min-w-0 space-y-2">
                <header className="flex flex-wrap items-baseline justify-between gap-2">
                  <h3 className="font-semibold">
                    {g.titolo}
                    {fissati.has(g.id) && (
                      <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 align-middle text-xs font-medium text-slate-600">
                        {t("inDashboard")}
                      </span>
                    )}
                  </h3>
                  <div className="flex flex-wrap gap-x-3 gap-y-1 text-sm">
                    <form action={fissaInDashboard.bind(null, id, g.id, !fissati.has(g.id))}>
                      <input type="hidden" name="ritorno" value={ritorno} />
                      <button type="submit" className="link">{fissati.has(g.id) ? t("togli") : t("fissa")}</button>
                    </form>
                    <Link href={`${conParametri(sp, parametriConfigurazione(g.config))}#costruttore`} className="link">
                      {t("modifica")}
                    </Link>
                    <Link href={`/condivisioni?grafico=${g.id}`} className="link">
                      {t("condividi")}
                    </Link>
                    <ConfermaElimina
                      etichetta={t("elimina")}
                      titolo={t("eliminaTitolo", { titolo: g.titolo })}
                      avviso={t("eliminaAvviso")}
                      conferma={t("eliminaConferma")}
                      azione={eliminaGrafico.bind(null, id, g.id)}
                    >
                      <input type="hidden" name="ritorno" value={ritorno} />
                    </ConfermaElimina>
                  </div>
                </header>
                {g.errore && <p className="text-sm text-red-600">{g.errore}</p>}
                {g.preparato && <GraficoLibero titolo={g.titolo} preparato={g.preparato} altezza={300} sottotitolo={sottotitolo} />}
              </article>
            ))}
          </div>
        )}
      </section>

      {/* Costruttore */}
      <section id="costruttore" className="scheda space-y-5">
        <div>
          <h2 className="text-xl font-semibold">{t("costruisci")}</h2>
          <p className="text-sm text-slate-500">{t("siAggiorna")}</p>
        </div>

        <FormPulito action="#costruttore" invioAutomatico className="space-y-4">
          <CampiNascosti sp={sp} tieni={(k) => !k.startsWith("c.")} />
          <div className="grid items-end gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Campo etichetta={t("tipo")}>
              <select name="c.tipo" defaultValue={config.tipo} className="campo py-1.5">
                <Opzioni elenco={TIPI.map((valore) => ({ valore, etichetta: tg(`tipo_${valore}`) }))} />
              </select>
            </Campo>

            {config.tipo !== "istogramma" && (
              <Campo etichetta={config.tipo === "dispersione" ? t("asseOrizzontale") : config.tipo === "box" ? t("unBoxPerOgni") : t("asseX")}>
                <select name="c.x" defaultValue={config.x ?? ""} className="campo py-1.5">
                  <Opzioni elenco={opz(adatte.x)} vuota={config.tipo === "box" ? t("tuttiInsieme") : undefined} />
                </select>
              </Campo>
            )}

            {xData && config.tipo !== "dispersione" && (
              <Campo etichetta={t("per")}>
                <select name="c.per" defaultValue={config.periodo} className="campo py-1.5">
                  <Opzioni elenco={PERIODI.map((valore) => ({ valore, etichetta: tg(`per_${valore}`) }))} />
                </select>
              </Campo>
            )}

            {(serie || config.tipo === "torta") && (
              <Campo etichetta={t("calcola")}>
                <select name="c.agg" defaultValue={config.aggregazione} className="campo py-1.5">
                  <Opzioni
                    elenco={AGGREGAZIONI.filter((k) => (adatte.y.length || k === "conteggio") && (config.tipo !== "barre_impilate" || k === "conteggio" || k === "somma")).map(
                      (valore) => ({ valore, etichetta: tg(`agg_${valore}`) }),
                    )}
                  />
                </select>
              </Campo>
            )}

            {config.tipo === "torta" && config.aggregazione !== "conteggio" && adatte.y.length > 0 && (
              <Campo etichetta={t("di")}>
                <select name="c.y" defaultValue={config.y[0]} className="campo py-1.5">
                  <Opzioni elenco={opz(adatte.y)} />
                </select>
              </Campo>
            )}

            {serie && adatte.suddividi.length > 0 && (
              <Campo etichetta={t("unaSeriePerOgni")}>
                <select name="c.sudd" defaultValue={config.suddividi ?? ""} className="campo py-1.5">
                  <Opzioni elenco={opz(adatte.suddividi.filter((c) => c.nome !== config.x))} vuota={config.tipo === "barre_impilate" ? undefined : t("nessuna")} />
                </select>
              </Campo>
            )}
          </div>

          {adatte.y.length > 0 && (config.aggregazione !== "conteggio" || unaSola) && config.tipo !== "torta" && (
            <fieldset className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
              <legend className="mb-1 font-medium">
                {config.tipo === "dispersione" ? t("asseVerticale") : unaSola || config.suddividi ? t("colonna") : t("colonnePiu")}
              </legend>
              {adatte.y.map((c) => (
                <label key={c.nome} className="inline-flex items-center gap-1.5">
                  <input
                    type={unaSola || config.suddividi ? "radio" : "checkbox"}
                    name="c.y"
                    value={c.nome}
                    defaultChecked={config.y.includes(c.nome)}
                  />
                  {c.originale}
                </label>
              ))}
            </fieldset>
          )}
          <noscript>
            <button type="submit" className="bottone">{t("aggiorna")}</button>
          </noscript>
        </FormPulito>

        {anteprima.error ? (
          <p className="text-sm text-red-600">{anteprima.error.message}</p>
        ) : (
          anteprima.data && (
            <div className="space-y-4 border-t border-slate-200 pt-4">
              <h3 className="font-semibold">{titolo}</h3>
              <GraficoLibero titolo={titolo} preparato={prepara(config, anteprima.data, colonne, f, tg)} sottotitolo={sottotitolo} />
              <form action={salvaGrafico.bind(null, id)} className="flex flex-wrap items-end gap-3">
                {Object.entries(parametriConfigurazione(config)).flatMap(([k, v]) =>
                  (Array.isArray(v) ? v : [v]).map((x) => <input key={`${k}-${x}`} type="hidden" name={k} value={x} />),
                )}
                <input type="hidden" name="ritorno" value={ritorno} />
                <label className="block min-w-64 flex-1 space-y-1 text-sm">
                  <span className="font-medium">{t("titolo")}</span>
                  <input name="titolo" placeholder={titolo} maxLength={120} className="campo py-1.5" />
                </label>
                <button type="submit" className="bottone">{t("salva")}</button>
              </form>
            </div>
          )
        )}
      </section>
    </div>
  );
}
