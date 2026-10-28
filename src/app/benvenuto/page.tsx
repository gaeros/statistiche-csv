import type { Metadata } from "next";
import Link from "next/link";
import { Colonne } from "@/components/grafici/Colonne";
import { Linee } from "@/components/grafici/Linee";
import { Torta } from "@/components/grafici/Torta";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Benvenuto – Statistiche da CSV" };

// Dati inventati, solo per mostrare che aspetto hanno i grafici.
const GIORNI = Array.from({ length: 14 }, (_, i) => `${String(i + 1).padStart(2, "0")}/10`);
const SISTOLICA = [128, 131, 126, 135, 142, 133, 129, 137, 144, 130, 127, 134, 139, 132];
const DIASTOLICA = [82, 84, 80, 86, 91, 85, 81, 88, 92, 83, 80, 86, 89, 84];
const CATEGORIE = [
  { nome: "Libri", valore: 14 },
  { nome: "Casa", valore: 9 },
  { nome: "Elettronica", valore: 6 },
  { nome: "Abbigliamento", valore: 5 },
  { nome: "Altro", valore: 3 },
];
const MESI = ["Mag", "Giu", "Lug", "Ago", "Set", "Ott"];
const SPESA = [64, 112, 48, 95, 131, 87];

const PASSI = [
  { titolo: "Carica il tuo file", testo: "Trascina un file CSV o Excel. Vedi un'anteprima e scegli tu cosa importare." },
  { titolo: "Guarda le statistiche", testo: "Medie, minimi e massimi, quante volte compare ogni valore, andamento nel tempo." },
  { titolo: "Filtra e crea grafici", testo: "Scegli il periodo o i valori che ti interessano: numeri e grafici si aggiornano insieme." },
];

function Esempio({ titolo, testo, children }: { titolo: string; testo: string; children: React.ReactNode }) {
  return (
    <section className="scheda space-y-2">
      <h3 className="font-semibold">{titolo}</h3>
      <p className="text-sm text-slate-600 dark:text-slate-400">{testo}</p>
      {children}
    </section>
  );
}

export default async function PaginaBenvenuto() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  const collegato = !!data.user;

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 space-y-12 px-4 py-10">
      <header className="space-y-4 text-center">
        <p className="text-sm font-medium text-blue-600 dark:text-blue-400">Statistiche da CSV</p>
        <h1 className="text-3xl font-semibold sm:text-4xl">Dai tuoi file di numeri a grafici che si capiscono</h1>
        <p className="mx-auto max-w-2xl text-slate-600 dark:text-slate-400">
          Hai un foglio con gli ordini di Amazon, le misure della pressione o le spese del mese? Caricalo e l&apos;app lo
          trasforma in statistiche e grafici, senza formule e senza saper programmare.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <Link href={collegato ? "/dataset" : "/accedi"} className="bottone">
            {collegato ? "Vai ai tuoi dati" : "Accedi"}
          </Link>
          {collegato && (
            <Link href="/importa" className="bottone-secondario">
              Carica un file
            </Link>
          )}
        </div>
        {!collegato && (
          <p className="text-xs text-slate-500">L&apos;accesso è solo su invito. Se vuoi provarla, chiedi un invito a chi ti ha mandato il link.</p>
        )}
      </header>

      <section aria-labelledby="come" className="space-y-4">
        <h2 id="come" className="text-xl font-semibold">Come funziona</h2>
        <ol className="grid gap-4 sm:grid-cols-3">
          {PASSI.map((p, i) => (
            <li key={p.titolo} className="scheda space-y-1">
              <span className="text-sm font-semibold text-blue-600 dark:text-blue-400">Passo {i + 1}</span>
              <h3 className="font-semibold">{p.titolo}</h3>
              <p className="text-sm text-slate-600 dark:text-slate-400">{p.testo}</p>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="esempi" className="space-y-4">
        <div className="space-y-1">
          <h2 id="esempi" className="text-xl font-semibold">Qualche esempio</h2>
          <p className="text-sm text-slate-500">I dati qui sotto sono inventati, servono solo a mostrare i grafici.</p>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <Esempio
            titolo="Pressione nel tempo"
            testo="Un file con data, massima e minima diventa un andamento. Puoi fissare una soglia: i valori sopra la soglia si colorano di rosso."
          >
            <Linee
              etichette={GIORNI}
              serie={[
                { nome: "Massima", valori: SISTOLICA, soglia: 140 },
                { nome: "Minima", valori: DIASTOLICA },
              ]}
              descrizione="Esempio: andamento di pressione massima e minima in 14 giorni, con soglia a 140 tratteggiata."
            />
          </Esempio>
          <Esempio
            titolo="Ordini per categoria"
            testo="Da un elenco di ordini vedi subito quali categorie pesano di più."
          >
            <Torta
              fette={CATEGORIE}
              descrizione="Esempio: 37 ordini divisi per categoria. Libri è la più numerosa."
            />
          </Esempio>
          <div className="lg:col-span-2">
            <Esempio
              titolo="Spesa mese per mese"
              testo="Somme, medie e conteggi per periodo, con i valori scritti sopra le barre."
            >
              <Colonne
                etichette={MESI}
                valori={SPESA}
                nomeValore="Spesa (€)"
                descrizione="Esempio: spesa mensile da maggio a ottobre, la più alta a settembre."
              />
            </Esempio>
          </div>
        </div>
      </section>

      <section aria-labelledby="cosa" className="space-y-4">
        <h2 id="cosa" className="text-xl font-semibold">Cosa puoi fare</h2>
        <ul className="grid gap-3 text-sm sm:grid-cols-2">
          <li className="scheda">Caricare file CSV ed Excel: l&apos;app riconosce da sola numeri, date e testo.</li>
          <li className="scheda">Filtrare per periodo, per valori o per momento della giornata.</li>
          <li className="scheda">Costruire i tuoi grafici (barre, linee, torta e altri) e salvarli nella dashboard.</li>
          <li className="scheda">Scaricare grafici come immagine e dati filtrati come CSV.</li>
        </ul>
      </section>

      <section aria-labelledby="privacy" className="scheda space-y-2">
        <h2 id="privacy" className="text-xl font-semibold">I tuoi dati restano tuoi</h2>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Vedi solo i tuoi file: nessun altro utente può leggerli. I dati sono conservati in Europa e puoi scaricarli o
          cancellare tutto quando vuoi dalla pagina del tuo account. L&apos;app mostra i numeri e non dà consigli medici.{" "}
          <Link href="/privacy" className="link">Leggi l&apos;informativa</Link>.
        </p>
      </section>
    </main>
  );
}
