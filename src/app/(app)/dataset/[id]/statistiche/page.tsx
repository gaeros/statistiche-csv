import Link from "next/link";
import { notFound } from "next/navigation";
import { formattaStatistica, formattaValore } from "@/lib/formato";
import { createClient } from "@/lib/supabase/server";
import { Intestazione } from "../Intestazione";
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

function CampiNascosti({ sp, escludi }: { sp: Parametri; escludi: string[] }) {
  return Object.entries(sp)
    .filter(([k, v]) => typeof v === "string" && !escludi.includes(k))
    .map(([k, v]) => <input key={k} type="hidden" name={k} value={v as string} />);
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

  // Scelte dell'utente (salvate nell'indirizzo della pagina)
  const periodoConteggi = scelta(sp.cp, PERIODI_CHIAVI, "month");

  const gruppi = [...categorie, ...date];
  const gruppo = scelta(sp.g, nomi, gruppi[0]?.nome ?? "");
  const gruppoData = date.some((c) => c.nome === gruppo);
  const periodoGruppo = scelta(sp.gp, PERIODI_CHIAVI, "month");
  const aggregazione = scelta(sp.a, AGGREGAZIONI_CHIAVI, numeriche.length ? "media" : "conteggio");
  const valore = scelta(sp.v, numeriche.map((c) => c.nome), numeriche[0]?.nome ?? "");

  const colonnaTempo = scelta(sp.td, date.map((c) => c.nome), date[0]?.nome ?? "");
  const valoreTempo = scelta(sp.tv, numeriche.map((c) => c.nome), numeriche[0]?.nome ?? "");
  const periodoTempo = scelta(sp.tp, PERIODI_CHIAVI, "week");
  const aggregazioneTempo = scelta(sp.ta, AGGREGAZIONI_CHIAVI, "media");
  const finestra = Math.min(52, Math.max(1, Number(sp.tf) || 4));

  const [stat, correlazioni, conteggi, raggruppamento, andamento] = await Promise.all([
    supabase.rpc("statistiche_colonne", { p_dataset: id, p_barre: 10 }),
    numeriche.length >= 2 ? supabase.rpc("correlazioni", { p_dataset: id }) : Promise.resolve({ data: [], error: null }),
    Promise.all(
      date.map((c) => supabase.rpc("conteggio_per_periodo", { p_dataset: id, p_colonna: c.nome, p_periodo: periodoConteggi })),
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
    colonnaTempo && (valoreTempo || aggregazioneTempo === "conteggio")
      ? supabase.rpc("andamento", {
          p_dataset: id,
          p_data: colonnaTempo,
          p_valore: valoreTempo || null,
          p_periodo: periodoTempo,
          p_aggregazione: aggregazioneTempo,
          p_finestra: finestra,
        })
      : Promise.resolve({ data: null, error: null }),
  ]);

  const statistiche = stat.data as Statistiche | null;
  const coppie = (correlazioni.data ?? []) as { a: string; b: string; r: number | null; n: number }[];
  const righeGruppi = (raggruppamento.data ?? []) as { gruppo: string | null; valore: number | null; righe: number }[];
  const serie = (andamento.data ?? []) as { periodo: string; valore: number | null; media_mobile: number | null; righe: number }[];

  const linkPeriodo = (p: Periodo) => {
    const q = new URLSearchParams(Object.entries(sp).filter((e): e is [string, string] => typeof e[1] === "string"));
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

      {/* Riepilogo per colonna */}
      {statistiche && (
        <section id="colonne" className="space-y-4">
          <h2 className="text-xl font-semibold">Colonne</h2>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {statistiche.colonne.map((c) => {
              const indiceData = date.findIndex((x) => x.nome === c.nome);
              const conteggio = indiceData >= 0 ? (conteggi[indiceData].data as { periodo: string; conteggio: number }[] | null) : null;
              return (
                <SchedaColonna
                  key={c.nome}
                  c={c}
                  totale={statistiche.totale}
                  conteggioPeriodi={
                    conteggio && conteggio.length > 0 ? (
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <h4 className="text-sm font-medium">Righe per {PERIODI[periodoConteggi]}</h4>
                          <div className="flex gap-2 text-xs">
                            {PERIODI_CHIAVI.map((p) => (
                              <Link
                                key={p}
                                href={linkPeriodo(p)}
                                scroll={false}
                                className={p === periodoConteggi ? "font-semibold text-blue-700 dark:text-blue-300" : "link"}
                              >
                                {PERIODI[p]}
                              </Link>
                            ))}
                          </div>
                        </div>
                        <div className="max-h-72 overflow-y-auto pr-1">
                          <Barre
                            righe={conteggio.map((x) => ({
                              etichetta: etichettaPeriodo(x.periodo, periodoConteggi),
                              valore: x.conteggio,
                            }))}
                          />
                        </div>
                      </div>
                    ) : undefined
                  }
                />
              );
            })}
          </div>
        </section>
      )}

      {/* Andamento nel tempo */}
      {date.length > 0 && numeriche.length > 0 && (
        <section id="andamento" className="scheda space-y-4">
          <div>
            <h2 className="text-xl font-semibold">Andamento nel tempo</h2>
            <p className="text-sm text-slate-500">
              I periodi senza dati restano vuoti: la media mobile usa solo i periodi con valori.
            </p>
          </div>
          <form action="#andamento" className="grid items-end gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <CampiNascosti sp={sp} escludi={["td", "tv", "tp", "ta", "tf"]} />
            <Seleziona nome="ta" etichetta="Calcola" valore={aggregazioneTempo}
              opzioni={AGGREGAZIONI_CHIAVI.map((a) => ({ valore: a, etichetta: AGGREGAZIONI[a] }))} />
            <Seleziona nome="tv" etichetta="di" valore={valoreTempo}
              opzioni={numeriche.map((c) => ({ valore: c.nome, etichetta: c.originale }))} />
            <Seleziona nome="tp" etichetta="per" valore={periodoTempo}
              opzioni={PERIODI_CHIAVI.map((p) => ({ valore: p, etichetta: PERIODI[p] }))} />
            <Seleziona nome="td" etichetta="secondo la data" valore={colonnaTempo}
              opzioni={date.map((c) => ({ valore: c.nome, etichetta: c.originale }))} />
            <label className="block space-y-1 text-sm">
              <span className="font-medium">Media mobile su</span>
              <input name="tf" type="number" min={1} max={52} defaultValue={finestra} className="campo py-1.5" />
            </label>
            <button type="submit" className="bottone">Calcola</button>
          </form>
          {andamento.error && <p className="text-sm text-red-600">{andamento.error.message}</p>}
          {serie.length > 0 && (
            <div className="max-h-[32rem] overflow-auto">
              <table className="w-full text-left text-sm">
                <thead className="sticky top-0 bg-white text-slate-500 dark:bg-slate-900">
                  <tr>
                    <th className="py-1 pr-3 font-medium">Periodo</th>
                    <th className="py-1 pr-3 text-right font-medium">
                      {AGGREGAZIONI[aggregazioneTempo]}
                      {aggregazioneTempo !== "conteggio" && ` di ${originale(valoreTempo)}`}
                    </th>
                    <th className="py-1 pr-3 text-right font-medium">Media mobile ({finestra})</th>
                    <th className="py-1 text-right font-medium">Righe</th>
                  </tr>
                </thead>
                <tbody>
                  {serie.map((s) => (
                    <tr key={s.periodo} className="border-t border-slate-100 dark:border-slate-800">
                      <td className="py-1 pr-3">{etichettaPeriodo(s.periodo, periodoTempo)}</td>
                      <td className="py-1 pr-3 text-right tabular-nums">{formattaStatistica(s.valore)}</td>
                      <td className="py-1 pr-3 text-right tabular-nums">{formattaStatistica(s.media_mobile)}</td>
                      <td className="py-1 text-right tabular-nums text-slate-500">{s.righe}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* Raggruppamenti */}
      {gruppi.length > 0 && (
        <section id="raggruppamenti" className="scheda space-y-4">
          <div>
            <h2 className="text-xl font-semibold">Raggruppamenti</h2>
            <p className="text-sm text-slate-500">Per esempio: media della sistolica per momento della giornata.</p>
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
            <Seleziona nome="gp" etichetta="periodo (se è una data)" valore={periodoGruppo}
              opzioni={PERIODI_CHIAVI.map((p) => ({ valore: p, etichetta: PERIODI[p] }))} />
            <button type="submit" className="bottone">Calcola</button>
          </form>
          {raggruppamento.error && <p className="text-sm text-red-600">{raggruppamento.error.message}</p>}
          {righeGruppi.length > 0 && (
            <Barre
              righe={righeGruppi.map((r) => ({
                etichetta:
                  r.gruppo === null
                    ? "(vuoto)"
                    : gruppoData
                      ? etichettaPeriodo(r.gruppo, periodoGruppo)
                      : colonne.find((c) => c.nome === gruppo)?.tipo === "booleano"
                        ? r.gruppo === "true" ? "Sì" : "No"
                        : r.gruppo,
                valore: r.valore === null ? null : Number(r.valore),
                nota: `${r.righe} righe`,
              }))}
              formattaValore={(n) => formattaStatistica(n)}
            />
          )}
        </section>
      )}

      {/* Correlazioni */}
      {coppie.length > 0 && (
        <section className="scheda space-y-4">
          <div>
            <h2 className="text-xl font-semibold">Correlazioni</h2>
            <p className="text-sm text-slate-500">
              Da −1 a +1: vicino a +1 le due colonne crescono insieme, vicino a −1 una cresce quando l&apos;altra
              cala, vicino a 0 non c&apos;è un legame lineare.
            </p>
          </div>
          <Barre
            righe={[...coppie]
              .sort((x, y) => Math.abs(y.r ?? 0) - Math.abs(x.r ?? 0))
              .map((c) => ({
                etichetta: `${originale(c.a)} ↔ ${originale(c.b)}`,
                valore: c.r === null ? null : Number(c.r),
                nota: `${c.n} coppie`,
              }))}
            formattaValore={(n) => formattaValore(Math.round(n * 100) / 100, "decimale")}
          />
        </section>
      )}
    </div>
  );
}
