import { formattaPercentuale, formattaStatistica, formattaValore } from "@/lib/formato";
import { Barre } from "./Barre";
import { DATE, NUMERICI, type StatColonna } from "./tipi";

const ETICHETTE_TIPO: Record<string, string> = {
  intero: "Intero",
  decimale: "Decimale",
  testo: "Testo",
  data: "Data",
  data_ora: "Data e ora",
  booleano: "Sì/No",
};

function Voce({ etichetta, valore }: { etichetta: string; valore: string }) {
  return (
    <div className="flex justify-between gap-2 border-b border-slate-100 py-1 last:border-0 dark:border-slate-800">
      <dt className="text-slate-500">{etichetta}</dt>
      <dd className="text-right tabular-nums">{valore}</dd>
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

  return (
    <section className="scheda space-y-4">
      <header className="flex items-baseline justify-between gap-2">
        <h3 className="font-semibold break-all">{c.originale}</h3>
        <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300">
          {ETICHETTE_TIPO[c.tipo] ?? c.tipo}
        </span>
      </header>

      <dl className="text-sm">
        <Voce etichetta="Valori" valore={c.valori.toLocaleString("it-IT")} />
        <Voce
          etichetta="Mancanti"
          valore={`${c.mancanti.toLocaleString("it-IT")} (${formattaPercentuale(c.mancanti, totale)})`}
        />
        <Voce etichetta="Valori distinti" valore={c.distinti.toLocaleString("it-IT")} />

        {numerica && c.valori > 0 && (
          <>
            <Voce etichetta="Media" valore={formattaStatistica(c.media)} />
            <Voce etichetta="Mediana" valore={formattaStatistica(c.mediana)} />
            <Voce etichetta="Minimo" valore={formattaStatistica(c.minimo)} />
            <Voce etichetta="Massimo" valore={formattaStatistica(c.massimo)} />
            <Voce etichetta="1° e 3° quartile" valore={`${formattaStatistica(c.q1)} · ${formattaStatistica(c.q3)}`} />
            <Voce etichetta="Deviazione standard" valore={formattaStatistica(c.dev_std)} />
            <Voce etichetta="Somma" valore={formattaStatistica(c.somma)} />
            <Voce
              etichetta="Valori anomali (regola IQR)"
              valore={
                c.anomali
                  ? `${c.anomali.toLocaleString("it-IT")} (sotto ${formattaStatistica(c.soglia_bassa)} o sopra ${formattaStatistica(c.soglia_alta)})`
                  : "nessuno"
              }
            />
          </>
        )}

        {data && c.prima && c.ultima && (
          <>
            <Voce etichetta="Prima" valore={formattaValore(c.prima, c.tipo)} />
            <Voce etichetta="Ultima" valore={formattaValore(c.ultima, c.tipo)} />
            <Voce etichetta="Intervallo coperto" valore={`${(c.giorni ?? 0).toLocaleString("it-IT")} giorni`} />
          </>
        )}
      </dl>

      {numerica && c.istogramma && c.istogramma.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium">Distribuzione</h4>
          <Barre
            righe={c.istogramma.map((b) => ({
              etichetta:
                c.tipo === "intero" && b.da === b.a
                  ? formattaStatistica(b.da)
                  : `${formattaStatistica(b.da)} – ${formattaStatistica(b.a)}`,
              valore: b.conteggio,
            }))}
          />
        </div>
      )}

      {c.frequenti && c.frequenti.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium">
            {c.distinti > 10 ? "I 10 valori più frequenti" : "Valori"}
          </h4>
          <Barre
            righe={c.frequenti.map((f) => ({
              etichetta: c.tipo === "booleano" ? (f.valore === "true" ? "Sì" : "No") : f.valore,
              valore: f.conteggio,
              nota: formattaPercentuale(f.conteggio, totale),
            }))}
          />
        </div>
      )}

      {conteggioPeriodi}
    </section>
  );
}
