import Link from "next/link";
import { notFound } from "next/navigation";
import { formattaStatistica, formattaValore } from "@/lib/formato";
import { createClient } from "@/lib/supabase/server";
import { Intestazione } from "../Intestazione";
import { Colonne } from "@/components/grafici/Colonne";
import { Linee } from "@/components/grafici/Linee";
import { Torta } from "@/components/grafici/Torta";
import { Barre } from "./Barre";
import { SchedaColonna } from "./SchedaColonna";
import {
  AGGREGAZIONI,
  DATE,
  NUMERICI,
  PERIODI,
  type Aggregazione,
  type Colonna,
  type Periodo,
  type Statistiche,
} from "./tipi";

type Parametri = Record<string, string | string[] | undefined>;

function scelta<T extends string>(valore: unknown, ammessi: readonly T[], predefinito: T): T {
  return typeof valore === "string" && (ammessi as readonly string[]).includes(valore) ? (valore as T) : predefinito;
}

const PERIODI_CHIAVI = Object.keys(PERIODI) as Periodo[];
const AGGREGAZIONI_CHIAVI = Object.keys(AGGREGAZIONI) as Aggregazione[];

// Etichetta di un periodo: "2026-09-28" → "28/09/2026", "set 2026", "2026" ...
function etichettaPeriodo(iso: string, periodo: Periodo): string {
  const d = new Date(`${iso}T00:00:00Z`);
  if (periodo === "year") return String(d.getUTCFullYear());
  if (periodo === "month") return d.toLocaleDateString("it-IT", { month: "short", year: "numeric", timeZone: "UTC" });
  if (periodo === "week") return `sett. del ${d.toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" })}`;
  return d.toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" });
}

// Periodo predefinito in base a quanti giorni coprono i dati: abbastanza punti, ma non troppi.
function periodoAdatto(giorni: number | undefined): Periodo {
  if (!giorni || giorni <= 92) return "day";
  if (giorni <= 730) return "week";
  if (giorni <= 3650) return "month";
  return "year";
}

function CampiNascosti({ sp, escludi }: { sp: Parametri; escludi: string[] }) {
  return Object.entries(sp)
    .filter(([k]) => !escludi.includes(k))
    .flatMap(([k, v]) => (Array.isArray(v) ? v : v === undefined ? [] : [v]).map((x, i) => ({ k, x, i })))
    .map(({ k, x, i }) => <input key={`${k}-${i}`} type="hidden" name={k} value={x} />);
}

function Seleziona({
  nome,
  etichetta,
  valore,
  opzioni,
}: {
  nome: string;
  etichetta: string;
  valore: string;
  opzioni: { valore: string; etichetta: string }[];
}) {
  return (
    <label className="block space-y-1 text-sm">
      <span className="font-medium">{etichetta}</span>
      <select name={nome} defaultValue={valore} className="campo py-1.5">
        {opzioni.map((o) => (
          <option key={o.valore} value={o.valore}>
            {o.etichetta}
          </option>
        ))}
      </select>
    </label>
  );
}

export default async function PaginaStatistiche({ params, searchParams }: PageProps<"/dataset/[id]/statistiche">) {
  const { id } = await params;
  const sp: Parametri = await searchParams;

  const supabase = await createClient();
  const { data: d } = await supabase
    .from("dataset")
    .select("id, nome, nome_originale, foglio, colonne, righe, created_at")
    .eq("id", id)
    .maybeSingle();
  if (!d) notFound();

  const colonne = d.colonne as Colonna[];
  const numeriche = colonne.filter((c) => NUMERICI.includes(c.tipo));
  const date = colonne.filter((c) => DATE.includes(c.tipo));
  const categorie = colonne.filter((c) => c.tipo === "testo" || c.tipo === "booleano");
  const nomi = colonne.map((c) => c.nome);
  const originale = (nome: string) => colonne.find((c) => c.nome === nome)?.originale ?? nome;

  const stat = await supabase.rpc("statistiche_colonne", { p_dataset: id, p_barre: 10 });
  const statistiche = stat.data as Statistiche | null;
  const giorniDi = (nome: string) => statistiche?.colonne.find((c) => c.nome === nome)?.giorni;

  // Scelte dell'utente (salvate nell'indirizzo della pagina)
  const periodoConteggi = typeof sp.cp === "string" ? scelta(sp.cp, PERIODI_CHIAVI, "month") : null;

  const gruppi = [...categorie, ...date];
  const gruppo = scelta(sp.g, nomi, gruppi[0]?.nome ?? "");
  const gruppoData = date.some((c) => c.nome === gruppo);
  const periodoGruppo = scelta(sp.gp, PERIODI_CHIAVI, periodoAdatto(giorniDi(gruppo)));
  const aggregazione = scelta(sp.a, AGGREGAZIONI_CHIAVI, numeriche.length ? "media" : "conteggio");
  const valore = scelta(sp.v, numeriche.map((c) => c.nome), numeriche[0]?.nome ?? "");

  const colonnaTempo = scelta(sp.td, date.map((c) => c.nome), date[0]?.nome ?? "");
  const periodoTempo = scelta(sp.tp, PERIODI_CHIAVI, periodoAdatto(giorniDi(colonnaTempo)));
  const aggregazioneTempo = scelta(sp.ta, AGGREGAZIONI_CHIAVI, "media");
  const sceltiTempo = (Array.isArray(sp.tv) ? sp.tv : sp.tv ? [sp.tv] : []).filter((v) =>
    numeriche.some((c) => c.nome === v),
  );
  // Senza una scelta: le prime tre colonne numeriche (es. sistolica, diastolica, battiti).
  const valoriTempo =
    aggregazioneTempo === "conteggio" ? [""] : sceltiTempo.length ? sceltiTempo : numeriche.slice(0, 3).map((c) => c.nome);

  const [correlazioni, conteggi, raggruppamento, andamenti] = await Promise.all([
    numeriche.length >= 2 ? supabase.rpc("correlazioni", { p_dataset: id }) : Promise.resolve({ data: [], error: null }),
    Promise.all(
      date.map((c) =>
        supabase.rpc("conteggio_per_periodo", {
          p_dataset: id,
          p_colonna: c.nome,
          p_periodo: periodoConteggi ?? periodoAdatto(giorniDi(c.nome)),
        }),
      ),
    ),
    gruppo
      ? supabase.rpc("raggruppa", {
          p_dataset: id,
          p_gruppo: gruppo,
          p_valore: aggregazione === "conteggio" ? null : valore,
          p_aggregazione: aggregazione,
          p_periodo: periodoGruppo,
        })
      : Promise.resolve({ data: null, error: null }),
    Promise.all(
      (colonnaTempo ? valoriTempo : []).map((v) =>
        supabase.rpc("andamento", {
          p_dataset: id,
          p_data: colonnaTempo,
          p_valore: v || null,
          p_periodo: periodoTempo,
          p_aggregazione: aggregazioneTempo,
          p_finestra: 1,
        }),
      ),
    ),
  ]);

  const coppie = (correlazioni.data ?? []) as { a: string; b: string; r: number | null; n: number }[];
  const righeGruppi = (raggruppamento.data ?? []) as { gruppo: string | null; valore: number | null; righe: number }[];

  // Le serie dell'andamento, allineate sugli stessi periodi
  type PuntoAndamento = { periodo: string; valore: number | null; righe: number };
  const erroreAndamento = andamenti.find((r) => r.error)?.error;
  const serieTempo = andamenti.map((r, i) => ({
    nome: valoriTempo[i] ? originale(valoriTempo[i]) : "Righe",
    punti: new Map(((r.data ?? []) as PuntoAndamento[]).map((p) => [p.periodo, p.valore === null ? null : Number(p.valore)])),
  }));
  const periodiTempo = [...new Set(andamenti.flatMap((r) => ((r.data ?? []) as PuntoAndamento[]).map((p) => p.periodo)))].sort();

  const gruppoBooleano = colonne.find((c) => c.nome === gruppo)?.tipo === "booleano";
  const etichettaGruppo = (g: string | null) =>
    g === null ? "(vuoto)" : gruppoData ? etichettaPeriodo(g, periodoGruppo) : gruppoBooleano ? (g === "true" ? "Sì" : "No") : g;
  const nomeCalcolo = `${AGGREGAZIONI[aggregazione]}${aggregazione === "conteggio" ? "" : ` di ${originale(valore)}`}`;

  const linkPeriodo = (p: Periodo) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(sp)) for (const x of Array.isArray(v) ? v : v ? [v] : []) q.append(k, x);
    q.set("cp", p);
    return `?${q}#colonne`;
  };

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
        attiva="statistiche"
      />

      {stat.error && <p className="text-red-600">Impossibile calcolare le statistiche: {stat.error.message}</p>}

      {/* Andamento nel tempo */}
      {date.length > 0 && numeriche.length > 0 && (
        <section id="andamento" className="scheda space-y-4">
          <div>
            <h2 className="text-xl font-semibold">Andamento nel tempo</h2>
            <p className="text-sm text-slate-500">
              {AGGREGAZIONI[aggregazioneTempo]} per {PERIODI[periodoTempo]}. Dove la linea si interrompe, in quel
              periodo non ci sono dati.
            </p>
          </div>
          <form action="#andamento" className="space-y-3">
            <CampiNascosti sp={sp} escludi={["td", "tv", "tp", "ta", "tf"]} />
            <fieldset className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
              <legend className="mb-1 font-medium">Colonne da mostrare</legend>
              {numeriche.map((c) => (
                <label key={c.nome} className="inline-flex items-center gap-1.5">
                  <input type="checkbox" name="tv" value={c.nome} defaultChecked={valoriTempo.includes(c.nome)} />
                  {c.originale}
                </label>
              ))}
            </fieldset>
            <div className="grid items-end gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Seleziona nome="ta" etichetta="Calcola" valore={aggregazioneTempo}
                opzioni={AGGREGAZIONI_CHIAVI.map((a) => ({ valore: a, etichetta: AGGREGAZIONI[a] }))} />
              <Seleziona nome="tp" etichetta="per" valore={periodoTempo}
                opzioni={PERIODI_CHIAVI.map((p) => ({ valore: p, etichetta: PERIODI[p] }))} />
              {date.length > 1 && (
                <Seleziona nome="td" etichetta="secondo la data" valore={colonnaTempo}
                  opzioni={date.map((c) => ({ valore: c.nome, etichetta: c.originale }))} />
              )}
              <button type="submit" className="bottone">Aggiorna il grafico</button>
            </div>
          </form>
          {erroreAndamento && <p className="text-sm text-red-600">{erroreAndamento.message}</p>}
          {periodiTempo.length > 0 && (
            <>
              <Linee
                descrizione={`Andamento nel tempo di ${serieTempo.map((x) => x.nome).join(", ")}`}
                etichette={periodiTempo.map((p) => etichettaPeriodo(p, periodoTempo))}
                serie={serieTempo.map((x) => ({ nome: x.nome, valori: periodiTempo.map((p) => x.punti.get(p) ?? null) }))}
              />
              <details className="text-sm">
                <summary className="cursor-pointer text-slate-500 select-none hover:text-slate-700 dark:hover:text-slate-300">
                  Vedi i numeri in tabella
                </summary>
                <div className="mt-2 max-h-96 overflow-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="sticky top-0 bg-white text-slate-500 dark:bg-slate-900">
                      <tr>
                        <th className="py-1 pr-3 font-medium">Periodo</th>
                        {serieTempo.map((x) => (
                          <th key={x.nome} className="py-1 pr-3 text-right font-medium">{x.nome}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {periodiTempo.map((p) => (
                        <tr key={p} className="border-t border-slate-100 dark:border-slate-800">
                          <td className="py-1 pr-3">{etichettaPeriodo(p, periodoTempo)}</td>
                          {serieTempo.map((x) => (
                            <td key={x.nome} className="py-1 pr-3 text-right tabular-nums">{formattaStatistica(x.punti.get(p))}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
            </>
          )}
        </section>
      )}

      {/* Riepilogo per colonna */}
      {statistiche && (
        <section id="colonne" className="space-y-4">
          <div>
            <h2 className="text-xl font-semibold">Colonna per colonna</h2>
            <p className="text-sm text-slate-500">Un riepilogo di ogni colonna del file, su {statistiche.totale.toLocaleString("it-IT")} righe.</p>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {statistiche.colonne.map((c) => {
              const indiceData = date.findIndex((x) => x.nome === c.nome);
              const conteggio = indiceData >= 0 ? (conteggi[indiceData].data as { periodo: string; conteggio: number }[] | null) : null;
              const periodo = periodoConteggi ?? periodoAdatto(c.giorni);
              return (
                <SchedaColonna
                  key={c.nome}
                  c={c}
                  totale={statistiche.totale}
                  conteggioPeriodi={
                    conteggio && conteggio.length > 0 ? (
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <h4 className="text-sm font-medium">Righe per {PERIODI[periodo]}</h4>
                          <div className="flex gap-2 text-xs">
                            {PERIODI_CHIAVI.map((p) => (
                              <Link
                                key={p}
                                href={linkPeriodo(p)}
                                scroll={false}
                                className={p === periodo ? "font-semibold text-blue-700 dark:text-blue-300" : "link"}
                              >
                                {PERIODI[p]}
                              </Link>
                            ))}
                          </div>
                        </div>
                        <Colonne
                          descrizione={`Numero di righe per ${PERIODI[periodo]} secondo ${c.originale}`}
                          nomeValore="Righe"
                          etichette={conteggio.map((x) => etichettaPeriodo(x.periodo, periodo))}
                          valori={conteggio.map((x) => x.conteggio)}
                        />
                      </div>
                    ) : undefined
                  }
                />
              );
            })}
          </div>
        </section>
      )}

      {/* Raggruppamenti */}
      {gruppi.length > 0 && (
        <section id="raggruppamenti" className="scheda space-y-4">
          <div>
            <h2 className="text-xl font-semibold">Confronta i gruppi</h2>
            <p className="text-sm text-slate-500">Per esempio: la media della sistolica per momento della giornata.</p>
          </div>
          <form action="#raggruppamenti" className="grid items-end gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <CampiNascosti sp={sp} escludi={["g", "v", "a", "gp"]} />
            <Seleziona nome="a" etichetta="Calcola" valore={aggregazione}
              opzioni={(numeriche.length ? AGGREGAZIONI_CHIAVI : (["conteggio"] as Aggregazione[])).map((a) => ({
                valore: a, etichetta: AGGREGAZIONI[a] }))} />
            {numeriche.length > 0 && (
              <Seleziona nome="v" etichetta="di" valore={valore}
                opzioni={numeriche.map((c) => ({ valore: c.nome, etichetta: c.originale }))} />
            )}
            <Seleziona nome="g" etichetta="per" valore={gruppo}
              opzioni={gruppi.map((c) => ({ valore: c.nome, etichetta: c.originale }))} />
            {gruppoData && (
              <Seleziona nome="gp" etichetta="raggruppando per" valore={periodoGruppo}
                opzioni={PERIODI_CHIAVI.map((p) => ({ valore: p, etichetta: PERIODI[p] }))} />
            )}
            <button type="submit" className="bottone">Aggiorna il grafico</button>
          </form>
          {raggruppamento.error && <p className="text-sm text-red-600">{raggruppamento.error.message}</p>}
          {righeGruppi.length > 0 &&
            (aggregazione === "conteggio" && !gruppoData && righeGruppi.length <= 8 ? (
              <Torta
                descrizione={`${nomeCalcolo} per ${originale(gruppo)}`}
                fette={righeGruppi.map((r) => ({ nome: etichettaGruppo(r.gruppo), valore: Number(r.valore ?? 0) }))}
              />
            ) : (
              <Colonne
                orizzontale={!gruppoData && righeGruppi.length > 8}
                descrizione={`${nomeCalcolo} per ${originale(gruppo)}`}
                nomeValore={nomeCalcolo}
                etichette={righeGruppi.map((r) => etichettaGruppo(r.gruppo))}
                valori={righeGruppi.map((r) => (r.valore === null ? null : Number(r.valore)))}
                altezza={gruppoData || righeGruppi.length <= 8 ? 260 : undefined}
              />
            ))}
        </section>
      )}

      {/* Correlazioni */}
      {coppie.length > 0 && (
        <section className="scheda space-y-4">
          <div>
            <h2 className="text-xl font-semibold">Colonne che vanno insieme</h2>
            <p className="text-sm text-slate-500">
              Da −1 a +1: vicino a +1 le due colonne crescono insieme, vicino a −1 una cresce quando l&apos;altra
              cala, vicino a 0 non c&apos;è un legame.
            </p>
          </div>
          <Barre
            righe={[...coppie]
              .sort((x, y) => Math.abs(y.r ?? 0) - Math.abs(x.r ?? 0))
              .map((c) => ({
                etichetta: `${originale(c.a)} e ${originale(c.b)}`,
                valore: c.r === null ? null : Number(c.r),
                nota: `${c.n} righe`,
              }))}
            formattaValore={(n) => formattaValore(Math.round(n * 100) / 100, "decimale")}
          />
        </section>
      )}
    </div>
  );
}
