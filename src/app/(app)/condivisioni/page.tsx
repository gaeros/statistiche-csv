import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { CopiaLink } from "@/components/CopiaLink";
import { DASHBOARD, percorsoCondiviso, SCADENZE, scaduto } from "@/lib/condivisioni";
import { createClient } from "@/lib/supabase/server";
import { creaLink, revocaLink } from "./actions";
import { formatiUtente } from "@/lib/utente";

type LinkSalvato = {
  id: string;
  token: string;
  grafico_id: string | null;
  scade_il: string | null;
  visite: number;
  ultima_visita: string | null;
  created_at: string;
  grafici: { titolo: string; dataset: { nome: string } | null } | null;
};

type GraficoScelta = { id: string; titolo: string; dataset: { nome: string } | null };

export async function generateMetadata() {
  return { title: (await getTranslations("condivisioni"))("metaTitolo") };
}

// Link di sola lettura: crearne uno per un grafico salvato o per la dashboard, copiarlo, revocarlo.
export default async function PaginaCondivisioni({ searchParams }: PageProps<"/condivisioni">) {
  const t = await getTranslations("condivisioni");
  const f = await formatiUtente();
  const sp = await searchParams;
  const scelto = typeof sp.grafico === "string" ? sp.grafico : DASHBOARD;
  const nuovo = typeof sp.nuovo === "string" ? sp.nuovo : undefined;

  const supabase = await createClient();
  const [{ data: link, error }, { data: grafici }] = await Promise.all([
    supabase
      .from("condivisioni")
      .select("id, token, grafico_id, scade_il, visite, ultima_visita, created_at, grafici(titolo, dataset(nome))")
      .order("created_at", { ascending: false }),
    supabase.from("grafici").select("id, titolo, dataset(nome)").order("created_at"),
  ]);
  const elenco = (link ?? []) as unknown as LinkSalvato[];

  // Grafici salvati raggruppati per dataset, per la scelta di cosa condividere
  const perDataset = new Map<string, GraficoScelta[]>();
  for (const g of (grafici ?? []) as unknown as GraficoScelta[]) {
    const nome = g.dataset?.nome ?? "";
    perDataset.set(nome, [...(perDataset.get(nome) ?? []), g]);
  }

  return (
    <div className="max-w-4xl space-y-8">
      <div className="space-y-1">
        <h1 className="text-3xl font-semibold tracking-normal">{t("titolo")}</h1>
        <p className="text-slate-600">{t("intro")}</p>
      </div>

      <section className="scheda space-y-4">
        <h2 className="text-xl font-semibold">{t("nuovo")}</h2>
        <form action={creaLink} className="grid items-end gap-3 sm:grid-cols-[1fr_auto_auto]">
          <label className="block min-w-0 space-y-1 text-sm">
            <span className="block font-medium">{t("cosa")}</span>
            <select name="cosa" defaultValue={scelto} className="campo py-1.5">
              <option value={DASHBOARD}>{t("laDashboard")}</option>
              {[...perDataset].map(([nome, lista]) => (
                <optgroup key={nome} label={t("datasetGruppo", { nome })}>
                  {lista.map((g) => (
                    <option key={g.id} value={g.id}>{g.titolo}</option>
                  ))}
                </optgroup>
              ))}
            </select>
          </label>
          <label className="block space-y-1 text-sm">
            <span className="block font-medium">{t("scadenza")}</span>
            <select name="scadenza" defaultValue={SCADENZE[0]} className="campo py-1.5">
              {SCADENZE.map((s) => (
                <option key={s} value={s}>{t(`scade_${s}`)}</option>
              ))}
            </select>
          </label>
          <button type="submit" className="bottone">{t("crea")}</button>
        </form>
        <p className="text-sm text-slate-500">{t("avviso")}</p>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold">{t("attivi")}</h2>
        {error && <p className="text-red-600">{t("errore", { dettaglio: error.message })}</p>}
        {!error && elenco.length === 0 && <p className="text-slate-500">{t("nessuno")}</p>}
        <ul className="space-y-3">
          {elenco.map((l) => {
            const finito = scaduto(l.scade_il);
            const cosa = l.grafico_id
              ? t("grafico", { titolo: l.grafici?.titolo ?? "", nome: l.grafici?.dataset?.nome ?? "" })
              : t("laDashboard");
            return (
              <li
                key={l.id}
                id={`link-${l.id}`}
                className={`scheda min-w-0 scroll-mt-6 space-y-3 ${l.id === nuovo ? "ring-2 ring-green-500" : ""}`}
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h3 className="font-semibold break-all">{cosa}</h3>
                  <span className={`text-sm ${finito ? "text-red-600" : "text-slate-500"}`}>
                    {finito
                      ? t("scadutoIl", { data: f.dataOra(l.scade_il!) })
                      : l.scade_il
                        ? t("scadeIl", { data: f.dataOra(l.scade_il) })
                        : t("nonScade")}
                  </span>
                </div>
                {l.id === nuovo && <p role="status" className="text-sm text-green-700">{t("creato")}</p>}
                {!finito && <CopiaLink percorso={percorsoCondiviso(l.token)} etichetta={t("indirizzo", { cosa })} />}
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-500">
                  <span>{t("creatoIl", { data: f.dataOra(l.created_at) })}</span>
                  <span>
                    {l.visite
                      ? t("visite", { n: l.visite, data: f.dataOra(l.ultima_visita ?? l.created_at) })
                      : t("maiAperto")}
                  </span>
                  {!finito && (
                    <Link href={percorsoCondiviso(l.token)} target="_blank" rel="noopener" className="link">
                      {t("apri")}
                    </Link>
                  )}
                  <form action={revocaLink.bind(null, l.id)}>
                    <button type="submit" className="text-red-600 hover:underline">
                      {finito ? t("elimina") : t("revoca")}
                    </button>
                  </form>
                </div>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
