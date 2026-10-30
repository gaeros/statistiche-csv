import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatiUtente, utenteCorrente } from "@/lib/utente";
import { leggiPreferenze } from "@/lib/preferenze";
import { FormElimina } from "./FormElimina";
import { FormFormati } from "./FormFormati";

export async function generateMetadata() {
  return { title: `${(await getTranslations("account"))("titolo")} – Datahue` };
}

export default async function PaginaAccount() {
  const t = await getTranslations("account");
  const f = await formatiUtente();
  const { utente } = await utenteCorrente();
  const supabase = await createClient();
  const { data: dataset } = await supabase.from("dataset").select("id, nome, righe").order("nome");
  const consenso = utente.user_metadata?.consenso_privacy as { data?: string } | undefined;

  return (
    <div className="max-w-3xl space-y-6">
      <h1 className="text-3xl font-semibold tracking-normal">{t("titolo")}</h1>

      <section className="scheda space-y-2 text-sm">
        <p>
          {t("email")} <b>{utente.email}</b>
        </p>
        {consenso?.data && (
          <p className="text-slate-500">
            {t("consenso", { data: f.dataOra(consenso.data) })}{" "}
            <Link href="/privacy" className="link">{t("informativa")}</Link>
          </p>
        )}
      </section>

      <section className="scheda space-y-3">
        <div>
          <h2 className="text-lg font-semibold">{t("formatiH")}</h2>
          <p className="text-sm text-slate-500">{t("formatiP")}</p>
        </div>
        <FormFormati preferenze={leggiPreferenze(utente.user_metadata)} />
      </section>

      <section className="scheda space-y-3">
        <h2 className="text-lg font-semibold">{t("scaricaH")}</h2>
        {dataset && dataset.length > 0 ? (
          <ul className="divide-y divide-slate-100 text-sm">
            {dataset.map((d) => (
              <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span className="font-mono break-all">{d.nome}</span>
                <span className="flex items-center gap-3">
                  <span className="text-slate-500">{t("righe", { n: f.numero(d.righe) })}</span>
                  <a href={`/dataset/${d.id}/esporta`} download className="link">{t("scaricaCsv")}</a>
                  <a href={`/dataset/${d.id}/excel`} download className="link">{t("scaricaExcel")}</a>
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-slate-500">{t("nessunDato")}</p>
        )}
      </section>

      <section className="scheda space-y-3 border-red-200">
        <h2 className="text-lg font-semibold text-red-700">{t("eliminaH")}</h2>
        <p className="text-sm text-slate-600">
          {t("eliminaP")}
        </p>
        <FormElimina />
      </section>
    </div>
  );
}
