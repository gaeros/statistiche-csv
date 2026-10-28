import Link from "next/link";
import { VERSIONE_INFORMATIVA } from "@/lib/privacy";

export const metadata = { title: "Informativa privacy · Datahue" };

// Bozza di informativa (SPEC §8.2): va fatta verificare da un esperto privacy prima di aprire l'app ad altri.
export default function PaginaPrivacy() {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 space-y-6 px-4 py-10 text-slate-700 dark:text-slate-300 [&_h2]:mt-6 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-slate-900 dark:[&_h2]:text-slate-100 [&_li]:ml-5 [&_li]:list-disc">
      <div className="space-y-1">
        <Link href="/" className="link text-sm">← Datahue</Link>
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Informativa sul trattamento dei dati</h1>
        <p className="text-sm text-slate-500">Versione del {VERSIONE_INFORMATIVA.split("-").reverse().join("/")}</p>
      </div>

      <h2>Chi tratta i dati</h2>
      <p>
        L&apos;app &quot;Datahue&quot; è gestita dal suo amministratore, la persona che ti ha invitato, che è il titolare
        del trattamento. L&apos;accesso è solo su invito. Per qualsiasi richiesta sui tuoi dati puoi scrivergli
        all&apos;indirizzo da cui hai ricevuto l&apos;invito.
      </p>

      <h2>Quali dati</h2>
      <ul>
        <li>Indirizzo email e, se accedi con Google, nome e immagine del profilo forniti da Google.</li>
        <li>
          I file che carichi e le tabelle create da essi. Possono contenere <b>dati relativi alla salute</b> (per esempio
          pressione e battiti), che il GDPR considera una categoria particolare di dati (art. 9).
        </li>
        <li>I grafici che salvi e le scelte tecniche necessarie al funzionamento (sessione di accesso).</li>
      </ul>

      <h2>Perché e su quale base</h2>
      <p>
        Solo per mostrarti statistiche e grafici sui tuoi dati. I dati relativi alla salute sono trattati solo con il tuo
        <b> consenso esplicito</b> (art. 9, par. 2, lett. a del GDPR), che dai al primo accesso e puoi revocare in ogni
        momento eliminando il tuo account.
      </p>

      <h2>Chi può vederli</h2>
      <ul>
        <li>Solo tu: ogni utente vede esclusivamente i propri dati, anche l&apos;amministratore non vi accede dall&apos;app.</li>
        <li>
          I dati sono conservati presso fornitori tecnici che agiscono come responsabili del trattamento: Supabase (database
          e file, server a Stoccolma, UE) e Vercel (esecuzione dell&apos;app, funzioni a Stoccolma, UE).
        </li>
        <li>Non ci sono pubblicità, strumenti di analisi del traffico o cessioni a terzi.</li>
      </ul>

      <h2>Per quanto tempo</h2>
      <p>
        Finché tieni il tuo account. Eliminando un dataset si cancellano la sua tabella e il file originale caricato;
        eliminando l&apos;account si cancellano tutti i tuoi dati.
      </p>

      <h2>I tuoi diritti</h2>
      <p>
        Puoi scaricare i tuoi dati in CSV ed eliminare il tuo account con tutti i dati dalla pagina{" "}
        <Link href="/account" className="link">Il mio account</Link>. Hai inoltre i diritti di accesso, rettifica,
        limitazione e opposizione, e puoi presentare reclamo al Garante per la protezione dei dati personali
        (www.garanteprivacy.it).
      </p>

      <h2>Nessun consiglio medico</h2>
      <p>
        L&apos;app mostra solo i dati che carichi e non fornisce diagnosi né consigli medici. Le soglie nei grafici sono scelte da
        te.
      </p>
    </main>
  );
}
