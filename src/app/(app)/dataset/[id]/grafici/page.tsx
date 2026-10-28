import Link from "next/link";
import { notFound } from "next/navigation";
import { CampiNascosti } from "@/components/CampiNascosti";
import { FormPulito } from "@/components/FormPulito";
import { GraficoLibero } from "@/components/grafici/GraficoLibero";
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
import { eliminaGrafico, salvaGrafico } from "./actions";

const SERIE = ["barre", "barre_impilate", "linee", "area"];

function Campo({ etichetta, children }: { etichetta: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1 text-sm">
      <span className="font-medium">{etichetta}</span>
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

  const [{ etichette, valori, queryFiltri }, { data: salvati }, anteprima] = await Promise.all([
    filtriDataset(supabase, id, colonne, sp),
    supabase.from("grafici").select("id, titolo, configurazione").eq("dataset_id", id).order("created_at"),
    supabase.rpc("dati_grafico", { p_dataset: id, p_config: config, p_filtri: filtri }),
  ]);

  // I grafici salvati si ricalcolano con i filtri attivi; la configurazione si ricontrolla sulle colonne attuali.
  const dashboard = await Promise.all(
    (salvati ?? []).map(async (g) => {
      const c = leggiConfigurazione(parametriConfigurazione(g.configurazione as Configurazione), colonne);
      const { data, error } = await supabase.rpc("dati_grafico", { p_dataset: id, p_config: c, p_filtri: filtri });
      return { id: g.id as string, titolo: g.titolo as string, config: c, preparato: data ? prepara(c, data, colonne) : null, errore: error?.message };
    }),
  );

  const adatte = colonneAdatte(config.tipo, colonne);
  const opz = (l: Colonna[]) => l.map((c) => ({ valore: c.nome, etichetta: c.originale }));
  const serie = SERIE.includes(config.tipo);
  const unaSola = !serie;
  const xData = colonne.some((c) => c.nome === config.x && (c.tipo === "data" || c.tipo === "data_ora"));
  const titolo = titoloAutomatico(config, colonne);
  const ritorno = conParametri(sp, {});

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

      {/* Dashboard personale */}
      <section id="dashboard" className="space-y-4">
        <div>
          <h2 className="text-xl font-semibold">La tua dashboard</h2>
          <p className="text-sm text-slate-500">
            {dashboard.length
              ? "I grafici che hai salvato per questo dataset. Seguono i filtri scelti qui sopra."
              : "Non hai ancora salvato grafici: costruiscine uno qui sotto e premi “Salva nella dashboard”."}
          </p>
        </div>
        {dashboard.length > 0 && (
          <div className="grid gap-4 lg:grid-cols-2">
            {dashboard.map((g) => (
              <article key={g.id} className="scheda min-w-0 space-y-2">
                <header className="flex flex-wrap items-baseline justify-between gap-2">
                  <h3 className="font-semibold">{g.titolo}</h3>
                  <div className="flex gap-3 text-sm">
                    <Link href={`${conParametri(sp, parametriConfigurazione(g.config))}#costruttore`} className="link">
                      Modifica
                    </Link>
                    <form action={eliminaGrafico.bind(null, id, g.id)}>
                      <input type="hidden" name="ritorno" value={ritorno} />
                      <button type="submit" className="text-red-600 hover:underline dark:text-red-400">Elimina</button>
                    </form>
                  </div>
                </header>
                {g.errore && <p className="text-sm text-red-600">{g.errore}</p>}
                {g.preparato && <GraficoLibero titolo={g.titolo} preparato={g.preparato} altezza={300} />}
              </article>
            ))}
          </div>
        )}
      </section>

      {/* Costruttore */}
      <section id="costruttore" className="scheda space-y-5">
        <div>
          <h2 className="text-xl font-semibold">Costruisci un grafico</h2>
          <p className="text-sm text-slate-500">Il grafico si aggiorna a ogni scelta.</p>
        </div>

        <FormPulito action="#costruttore" invioAutomatico className="space-y-4">
          <CampiNascosti sp={sp} tieni={(k) => !k.startsWith("c.")} />
          <div className="grid items-end gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Campo etichetta="Tipo di grafico">
              <select name="c.tipo" defaultValue={config.tipo} className="campo py-1.5">
                <Opzioni elenco={Object.entries(TIPI).map(([valore, etichetta]) => ({ valore, etichetta }))} />
              </select>
            </Campo>

            {config.tipo !== "istogramma" && (
              <Campo etichetta={config.tipo === "dispersione" ? "Asse orizzontale" : config.tipo === "box" ? "Un box per ogni" : "Asse X (raggruppa per)"}>
                <select name="c.x" defaultValue={config.x ?? ""} className="campo py-1.5">
                  <Opzioni elenco={opz(adatte.x)} vuota={config.tipo === "box" ? "– tutti insieme –" : undefined} />
                </select>
              </Campo>
            )}

            {xData && config.tipo !== "dispersione" && (
              <Campo etichetta="Per">
                <select name="c.per" defaultValue={config.periodo} className="campo py-1.5">
                  <Opzioni elenco={Object.entries(PERIODI).map(([valore, etichetta]) => ({ valore, etichetta }))} />
                </select>
              </Campo>
            )}

            {(serie || config.tipo === "torta") && (
              <Campo etichetta="Calcola">
                <select name="c.agg" defaultValue={config.aggregazione} className="campo py-1.5">
                  <Opzioni
                    elenco={Object.entries(AGGREGAZIONI)
                      .filter(([k]) => (adatte.y.length || k === "conteggio") && (config.tipo !== "barre_impilate" || k === "conteggio" || k === "somma"))
                      .map(([valore, etichetta]) => ({ valore, etichetta }))}
                  />
                </select>
              </Campo>
            )}

            {serie && adatte.suddividi.length > 0 && (
              <Campo etichetta="Una serie per ogni">
                <select name="c.sudd" defaultValue={config.suddividi ?? ""} className="campo py-1.5">
                  <Opzioni elenco={opz(adatte.suddividi.filter((c) => c.nome !== config.x))} vuota={config.tipo === "barre_impilate" ? undefined : "– nessuna –"} />
                </select>
              </Campo>
            )}
          </div>

          {adatte.y.length > 0 && (config.aggregazione !== "conteggio" || unaSola) && config.tipo !== "torta" ? (
            <fieldset className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
              <legend className="mb-1 font-medium">
                {config.tipo === "dispersione" ? "Asse verticale" : unaSola || config.suddividi ? "Colonna" : "Colonne (anche più di una)"}
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
          ) : (
            config.tipo === "torta" && config.aggregazione !== "conteggio" && (
              <Campo etichetta="di">
                <select name="c.y" defaultValue={config.y[0]} className="campo max-w-xs py-1.5">
                  <Opzioni elenco={opz(adatte.y)} />
                </select>
              </Campo>
            )
          )}
          <noscript>
            <button type="submit" className="bottone">Aggiorna il grafico</button>
          </noscript>
        </FormPulito>

        {anteprima.error ? (
          <p className="text-sm text-red-600">{anteprima.error.message}</p>
        ) : (
          anteprima.data && (
            <div className="space-y-4 border-t border-slate-200 pt-4 dark:border-slate-800">
              <h3 className="font-semibold">{titolo}</h3>
              <GraficoLibero titolo={titolo} preparato={prepara(config, anteprima.data, colonne)} />
              <form action={salvaGrafico.bind(null, id)} className="flex flex-wrap items-end gap-3">
                {Object.entries(parametriConfigurazione(config)).flatMap(([k, v]) =>
                  (Array.isArray(v) ? v : [v]).map((x) => <input key={`${k}-${x}`} type="hidden" name={k} value={x} />),
                )}
                <input type="hidden" name="ritorno" value={ritorno} />
                <label className="block min-w-64 flex-1 space-y-1 text-sm">
                  <span className="font-medium">Titolo</span>
                  <input name="titolo" placeholder={titolo} maxLength={120} className="campo py-1.5" />
                </label>
                <button type="submit" className="bottone">Salva nella dashboard</button>
              </form>
            </div>
          )
        )}
      </section>
    </div>
  );
}
