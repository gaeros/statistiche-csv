import Link from "next/link";
import { formattaDataOra, formattaNumero } from "@/lib/formato";
import { createClient } from "@/lib/supabase/server";
import { utenteCorrente } from "@/lib/utente";
import { FormElimina } from "./FormElimina";

export default async function PaginaAccount() {
  const { utente } = await utenteCorrente();
  const supabase = await createClient();
  const { data: dataset } = await supabase.from("dataset").select("id, nome, righe").order("nome");
  const consenso = utente.user_metadata?.consenso_privacy as { data?: string } | undefined;

  return (
    <div className="max-w-3xl space-y-6">
      <h1 className="text-2xl font-semibold">Il mio account</h1>

      <section className="scheda space-y-2 text-sm">
        <p>
          Email: <b>{utente.email}</b>
        </p>
        {consenso?.data && (
          <p className="text-slate-500">
            Consenso al trattamento dei dati dato il {formattaDataOra(consenso.data)} ·{" "}
            <Link href="/privacy" className="link">informativa</Link>
          </p>
        )}
      </section>

      <section className="scheda space-y-3">
        <h2 className="text-lg font-semibold">Scarica i tuoi dati</h2>
        {dataset && dataset.length > 0 ? (
          <ul className="divide-y divide-slate-100 text-sm dark:divide-slate-800">
            {dataset.map((d) => (
              <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span className="font-mono break-all">{d.nome}</span>
                <span className="flex items-center gap-3">
                  <span className="text-slate-500">{formattaNumero(d.righe)} righe</span>
                  <a href={`/dataset/${d.id}/esporta`} download className="link">Scarica CSV</a>
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-slate-500">Non hai ancora dati caricati.</p>
        )}
      </section>

      <section className="scheda space-y-3 border-red-200 dark:border-red-900">
        <h2 className="text-lg font-semibold text-red-700 dark:text-red-400">Elimina l&apos;account</h2>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Cancella per sempre il tuo account, tutte le tabelle, i file caricati e i grafici salvati. Non si può annullare:
          se vuoi conservare qualcosa, scaricalo prima.
        </p>
        <FormElimina />
      </section>
    </div>
  );
}
