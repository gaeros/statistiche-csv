import { getLocale, getTranslations } from "next-intl/server";
import { Colonne } from "@/components/grafici/Colonne";
import { Torta } from "@/components/grafici/Torta";
import { creaFormati } from "@/lib/formato";
import { DATE, NUMERICI, type StatColonna } from "./tipi";

// Oltre questo numero di valori diversi la torta diventa illeggibile: si passa alle barre.
const MAX_FETTE = 8;

function Voce({ etichetta, valore }: { etichetta: string; valore: string }) {
  return (
    <div className="flex justify-between gap-2 border-b border-slate-100 py-1 last:border-0 dark:border-slate-800">
      <dt className="text-slate-500">{etichetta}</dt>
      <dd className="text-right tabular-nums">{valore}</dd>
    </div>
  );
}

function Riquadro({ etichetta, valore }: { etichetta: string; valore: string }) {
  return (
    <div className="rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-800/60">
      <div className="text-xs text-slate-500">{etichetta}</div>
      <div className="text-lg font-semibold tabular-nums">{valore}</div>
    </div>
  );
}

export async function SchedaColonna({
  c,
  totale,
  conteggioPeriodi,
}: {
  c: StatColonna;
  totale: number;
  conteggioPeriodi?: React.ReactNode;
}) {
  const t = await getTranslations("colonna");
  const f = creaFormati(await getLocale());
  const numerica = NUMERICI.includes(c.tipo);
  const data = DATE.includes(c.tipo);
  const categorie = c.tipo === "testo" || c.tipo === "booleano";
  const tuttiDiversi = categorie && c.valori > 1 && c.distinti === c.valori;
  const etichetta = (v: string) => (c.tipo === "booleano" ? (v === "true" ? f.si : f.no) : v);

  const frequenti = c.frequenti ?? [];
  const altri = c.valori - frequenti.reduce((s, f) => s + f.conteggio, 0);

  return (
    <section className="scheda min-w-0 space-y-4">
      <header className="flex items-baseline justify-between gap-2">
        <h3 className="font-semibold break-all">{c.originale}</h3>
        <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300">
          {["intero", "decimale", "testo", "data", "data_ora", "booleano"].includes(c.tipo) ? t(`tipo_${c.tipo}`) : c.tipo}
        </span>
      </header>

      {c.valori === 0 && <p className="text-sm text-slate-500">{t("vuota")}</p>}

      {numerica && c.valori > 0 && (
        <>
          <div className="grid grid-cols-3 gap-2">
            <Riquadro etichetta={t("media")} valore={f.statistica(c.media)} />
            <Riquadro etichetta={t("minimo")} valore={f.statistica(c.minimo)} />
            <Riquadro etichetta={t("massimo")} valore={f.statistica(c.massimo)} />
          </div>
          {c.istogramma && c.istogramma.length > 0 && (
            <div className="space-y-1">
              <h4 className="text-sm font-medium">{t("perFascia")}</h4>
              <Colonne
                descrizione={t("descDistribuzione", { colonna: c.originale })}
                nomeValore={t("righe")}
                etichette={c.istogramma.map((b) =>
                  c.tipo === "intero" && b.da === b.a
                    ? f.statistica(b.da)
                    : `${f.statistica(b.da)}–${f.statistica(b.a)}`,
                )}
                valori={c.istogramma.map((b) => b.conteggio)}
              />
            </div>
          )}
        </>
      )}

      {categorie && frequenti.length > 0 && !tuttiDiversi && (
        <div className="space-y-1">
          <h4 className="text-sm font-medium">
            {c.distinti > frequenti.length ? t("piuFrequenti", { n: frequenti.length }) : t("comeSiDividono")}
          </h4>
          {c.distinti <= MAX_FETTE ? (
            <Torta
              descrizione={t("descSuddivisione", { colonna: c.originale })}
              fette={frequenti.map((f) => ({ nome: etichetta(f.valore), valore: f.conteggio }))}
            />
          ) : (
            <Colonne
              orizzontale
              descrizione={t("descFrequenti", { colonna: c.originale })}
              nomeValore={t("righe")}
              etichette={[...frequenti.map((f) => etichetta(f.valore)), ...(altri > 0 ? [t("altriValori")] : [])]}
              valori={[...frequenti.map((f) => f.conteggio), ...(altri > 0 ? [altri] : [])]}
            />
          )}
        </div>
      )}
      {tuttiDiversi && (
        <p className="text-sm text-slate-500">{t("tuttiDiversi")}</p>
      )}

      {data && c.prima && c.ultima && (
        <p className="text-sm">
          {t.rich("dalAl", { da: f.valore(c.prima, c.tipo), a: f.valore(c.ultima, c.tipo), b: (chunks) => <b>{chunks}</b> })}
          <span className="text-slate-500"> {t("giorni", { n: f.numero(c.giorni ?? 0) })}</span>
        </p>
      )}

      {conteggioPeriodi}

      <details className="text-sm">
        <summary className="cursor-pointer text-slate-500 select-none hover:text-slate-700 dark:hover:text-slate-300">
          {t("altriDettagli")}
        </summary>
        <dl className="mt-2">
          <Voce etichetta={t("valori")} valore={f.numero(c.valori)} />
          <Voce
            etichetta={t("celleVuote")}
            valore={`${f.numero(c.mancanti)} (${f.percentuale(c.mancanti, totale)})`}
          />
          <Voce etichetta={t("valoriDiversi")} valore={f.numero(c.distinti)} />
          {numerica && c.valori > 0 && (
            <>
              <Voce etichetta={t("mediana")} valore={f.statistica(c.mediana)} />
              <Voce etichetta={t("metaTra")} valore={t("metaTraValore", { q1: f.statistica(c.q1), q3: f.statistica(c.q3) })} />
              <Voce etichetta={t("devStd")} valore={f.statistica(c.dev_std)} />
              <Voce etichetta={t("somma")} valore={f.statistica(c.somma)} />
              <Voce
                etichetta={t("insoliti")}
                valore={
                  c.anomali
                    ? t("insolitiValore", { n: f.numero(c.anomali), basso: f.statistica(c.soglia_bassa), alto: f.statistica(c.soglia_alta) })
                    : t("nessuno")
                }
              />
            </>
          )}
        </dl>
      </details>
    </section>
  );
}
