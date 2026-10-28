import { Colonne } from "@/components/grafici/Colonne";
import { Torta } from "@/components/grafici/Torta";
import { formattaPercentuale, formattaStatistica, formattaValore } from "@/lib/formato";
import { DATE, NUMERICI, type StatColonna } from "./tipi";

const ETICHETTE_TIPO: Record<string, string> = {
  intero: "Numero intero",
  decimale: "Numero",
  testo: "Testo",
  data: "Data",
  data_ora: "Data e ora",
  booleano: "Sì/No",
};

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

export function SchedaColonna({
  c,
  totale,
  conteggioPeriodi,
}: {
  c: StatColonna;
  totale: number;
  conteggioPeriodi?: React.ReactNode;
}) {
  const numerica = NUMERICI.includes(c.tipo);
  const data = DATE.includes(c.tipo);
  const categorie = c.tipo === "testo" || c.tipo === "booleano";
  const tuttiDiversi = categorie && c.valori > 1 && c.distinti === c.valori;
  const etichetta = (v: string) => (c.tipo === "booleano" ? (v === "true" ? "Sì" : "No") : v);

  const frequenti = c.frequenti ?? [];
  const altri = c.valori - frequenti.reduce((s, f) => s + f.conteggio, 0);

  return (
    <section className="scheda min-w-0 space-y-4">
      <header className="flex items-baseline justify-between gap-2">
        <h3 className="font-semibold break-all">{c.originale}</h3>
        <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300">
          {ETICHETTE_TIPO[c.tipo] ?? c.tipo}
        </span>
      </header>

      {c.valori === 0 && <p className="text-sm text-slate-500">La colonna è vuota.</p>}

      {numerica && c.valori > 0 && (
        <>
          <div className="grid grid-cols-3 gap-2">
            <Riquadro etichetta="Media" valore={formattaStatistica(c.media)} />
            <Riquadro etichetta="Minimo" valore={formattaStatistica(c.minimo)} />
            <Riquadro etichetta="Massimo" valore={formattaStatistica(c.massimo)} />
          </div>
          {c.istogramma && c.istogramma.length > 0 && (
            <div className="space-y-1">
              <h4 className="text-sm font-medium">Quante righe per fascia di valori</h4>
              <Colonne
                descrizione={`Distribuzione dei valori di ${c.originale}`}
                nomeValore="Righe"
                etichette={c.istogramma.map((b) =>
                  c.tipo === "intero" && b.da === b.a
                    ? formattaStatistica(b.da)
                    : `${formattaStatistica(b.da)}–${formattaStatistica(b.a)}`,
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
            {c.distinti > frequenti.length ? `I ${frequenti.length} valori più frequenti` : "Come si dividono le righe"}
          </h4>
          {c.distinti <= MAX_FETTE ? (
            <Torta
              descrizione={`Suddivisione delle righe per ${c.originale}`}
              fette={frequenti.map((f) => ({ nome: etichetta(f.valore), valore: f.conteggio }))}
            />
          ) : (
            <Colonne
              orizzontale
              descrizione={`Valori più frequenti di ${c.originale}`}
              nomeValore="Righe"
              etichette={[...frequenti.map((f) => etichetta(f.valore)), ...(altri > 0 ? ["Altri valori"] : [])]}
              valori={[...frequenti.map((f) => f.conteggio), ...(altri > 0 ? [altri] : [])]}
            />
          )}
        </div>
      )}
      {tuttiDiversi && (
        <p className="text-sm text-slate-500">Ogni riga ha un valore diverso, quindi non c&apos;è un grafico da fare.</p>
      )}

      {data && c.prima && c.ultima && (
        <p className="text-sm">
          Dal <b>{formattaValore(c.prima, c.tipo)}</b> al <b>{formattaValore(c.ultima, c.tipo)}</b>
          <span className="text-slate-500"> ({(c.giorni ?? 0).toLocaleString("it-IT")} giorni)</span>
        </p>
      )}

      {conteggioPeriodi}

      <details className="text-sm">
        <summary className="cursor-pointer text-slate-500 select-none hover:text-slate-700 dark:hover:text-slate-300">
          Altri dettagli
        </summary>
        <dl className="mt-2">
          <Voce etichetta="Valori" valore={c.valori.toLocaleString("it-IT")} />
          <Voce
            etichetta="Celle vuote"
            valore={`${c.mancanti.toLocaleString("it-IT")} (${formattaPercentuale(c.mancanti, totale)})`}
          />
          <Voce etichetta="Valori diversi" valore={c.distinti.toLocaleString("it-IT")} />
          {numerica && c.valori > 0 && (
            <>
              <Voce etichetta="Mediana (valore centrale)" valore={formattaStatistica(c.mediana)} />
              <Voce etichetta="Metà dei valori è tra" valore={`${formattaStatistica(c.q1)} e ${formattaStatistica(c.q3)}`} />
              <Voce etichetta="Deviazione standard" valore={formattaStatistica(c.dev_std)} />
              <Voce etichetta="Somma" valore={formattaStatistica(c.somma)} />
              <Voce
                etichetta="Valori insoliti"
                valore={
                  c.anomali
                    ? `${c.anomali.toLocaleString("it-IT")} (sotto ${formattaStatistica(c.soglia_bassa)} o sopra ${formattaStatistica(c.soglia_alta)})`
                    : "nessuno"
                }
              />
            </>
          )}
        </dl>
      </details>
    </section>
  );
}
