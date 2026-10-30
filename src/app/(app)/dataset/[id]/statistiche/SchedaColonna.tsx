import { getLocale, getTranslations } from "next-intl/server";
import { Colonne } from "@/components/grafici/Colonne";
import { Torta } from "@/components/grafici/Torta";
import { creaFormati } from "@/lib/formato";
import { DATE, NUMERICI, type StatColonna } from "./tipi";

// Oltre questo numero di valori diversi la torta diventa illeggibile: si passa alle barre.
const MAX_FETTE = 8;

function Voce({ etichetta, valore }: { etichetta: string; valore: string }) {
  return (
    <div className="flex justify-between gap-2 border-b border-slate-100 py-1 last:border-0">
      <dt className="text-slate-500">{etichetta}</dt>
      <dd className="text-right tabular-nums">{valore}</dd>
    </div>
  );
}

// Le cifre dei tre riquadri hanno la stessa dimensione, scelta in base al numero più lungo e alla
// larghezza del riquadro (unità cqi): anche numeri come 1.022.800.633 si leggono interi.
// Se lo spazio non basta neppure alla dimensione minima, i riquadri vanno a capo (vedi RIQUADRI_MIN).
const LARGHEZZA_CIFRA = 0.55; // in em, media di cifre tabulari e separatori
const CORPO_MIN = 13; // px

function Riquadro({ etichetta, valore, caratteri }: { etichetta: string; valore: string; caratteri: number }) {
  return (
    <div className="min-w-0 rounded-lg bg-slate-50 px-3 py-2 [container-type:inline-size]">
      <div className="truncate text-xs text-slate-500">{etichetta}</div>
      <div
        className="leading-tight font-semibold whitespace-nowrap tabular-nums"
        style={{ fontSize: `clamp(${CORPO_MIN}px, calc(100cqi / ${(caratteri * LARGHEZZA_CIFRA).toFixed(2)}), 1.125rem)` }}
      >
        {valore}
      </div>
    </div>
  );
}

// Larghezza minima di un riquadro: la cifra più lunga al corpo minimo, più i margini interni.
function larghezzaRiquadri(caratteri: number) {
  return `repeat(auto-fit, minmax(${Math.ceil(caratteri * LARGHEZZA_CIFRA * CORPO_MIN + 26)}px, 1fr))`;
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
      {/* pr-10: a destra c'è il pulsante per ingrandire la scheda (SchedeRiordinabili) */}
      <header className="pr-10">
        <h3 className="font-semibold break-all">{c.originale}</h3>
      </header>

      {c.valori === 0 && <p className="text-sm text-slate-500">{t("vuota")}</p>}

      {numerica && c.valori > 0 && (
        <>
          {(() => {
            const valori = [f.statistica(c.media), f.statistica(c.minimo), f.statistica(c.massimo)];
            const caratteri = Math.max(4, ...valori.map((v) => v.length));
            return (
              <div className="grid gap-2" style={{ gridTemplateColumns: larghezzaRiquadri(caratteri) }}>
                <Riquadro etichetta={t("media")} valore={valori[0]} caratteri={caratteri} />
                <Riquadro etichetta={t("minimo")} valore={valori[1]} caratteri={caratteri} />
                <Riquadro etichetta={t("massimo")} valore={valori[2]} caratteri={caratteri} />
              </div>
            );
          })()}
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
        <summary className="cursor-pointer text-slate-500 select-none hover:text-slate-700">
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
