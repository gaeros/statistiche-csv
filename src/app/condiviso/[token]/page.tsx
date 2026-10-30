import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import Link from "next/link";
import { notFound } from "next/navigation";
import { GraficoLibero } from "@/components/grafici/GraficoLibero";
import { Logo } from "@/components/Logo";
import { SelettoreLingua } from "@/components/SelettoreLingua";
import { SelettoreTema } from "@/components/SelettoreTema";
import { codiceValido } from "@/lib/condivisioni";
import type { Colonna } from "@/lib/filtri";
import { creaFormati } from "@/lib/formato";
import { leggiConfigurazione, parametriConfigurazione, prepara, type Configurazione } from "@/lib/grafici";
import { createAdminClient } from "@/lib/supabase/admin";

type Condivisione = {
  dashboard: boolean;
  scade_il: string | null;
  grafici: { id: string; titolo: string; configurazione: Configurazione; dataset_id: string; dataset_nome: string; colonne: Colonna[] }[];
};

// Il link non va nei motori di ricerca e non passa ad altri siti (niente Referer).
export async function generateMetadata(): Promise<Metadata> {
  return {
    title: (await getTranslations("condiviso"))("metaTitolo"),
    robots: { index: false, follow: false },
    referrer: "no-referrer",
  };
}

// Pagina pubblica di un link di sola lettura (SPEC §6.5): nessun accesso, nessuna modifica.
// Gira solo sul server: con la chiave di servizio legge il link e calcola i grafici con la
// configurazione salvata. Al browser arrivano solo i valori già calcolati dei grafici.
export default async function PaginaCondivisa({ params }: PageProps<"/condiviso/[token]">) {
  const { token } = await params;
  if (!codiceValido(token)) notFound();

  const admin = createAdminClient();
  const { data, error } = await admin.rpc("leggi_condivisione", { p_token: token });
  if (error) throw new Error(error.message);
  const c = data as Condivisione | null;
  if (!c) notFound();

  const t = await getTranslations("condiviso");
  const tg = await getTranslations("grafici");
  const tc = await getTranslations("chart");
  const f = creaFormati(await getLocale());

  const schede = await Promise.all(
    c.grafici.map(async (g) => {
      const config = leggiConfigurazione(parametriConfigurazione(g.configurazione), g.colonne);
      const { data: dati, error: e } = await admin.rpc("dati_grafico", { p_dataset: g.dataset_id, p_config: config, p_filtri: [] });
      return { ...g, preparato: dati ? prepara(config, dati, g.colonne, f, tg) : null, errore: !!e };
    }),
  );

  return (
    <>
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
          <Link href="/">
            <Logo className="h-11 w-auto" />
          </Link>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
            {t("solaLettura")}
          </span>
          <div className="ml-auto flex items-center gap-2">
            <SelettoreTema />
            <SelettoreLingua />
          </div>
        </div>
      </header>
      <main className="mx-auto w-full min-w-0 max-w-6xl flex-1 space-y-6 px-4 py-8">
        <div className="space-y-1">
          <h1 className="text-3xl font-semibold tracking-normal">
            {c.dashboard ? t("titoloDashboard") : (schede[0]?.titolo ?? t("titoloGrafico"))}
          </h1>
          <p className="text-sm text-slate-500">
            {t("spiegazione")} {c.scade_il ? t("scadeIl", { data: f.dataOra(c.scade_il) }) : ""}
          </p>
        </div>

        {schede.length === 0 && <p className="scheda text-slate-600">{t("vuota")}</p>}

        <div className={`grid gap-4 ${schede.length > 1 ? "lg:grid-cols-2" : ""}`}>
          {schede.map((g) => (
            <article key={g.id} className="scheda min-w-0 space-y-3">
              <header className="space-y-0.5">
                <h2 className="font-semibold">{g.titolo}</h2>
                <p className="text-sm text-slate-500 break-all">{t("daDataset", { nome: g.dataset_nome })}</p>
              </header>
              {g.errore && <p className="text-sm text-red-600">{t("errore")}</p>}
              {g.preparato && (
                <GraficoLibero
                  titolo={g.titolo}
                  preparato={g.preparato}
                  altezza={schede.length > 1 ? 300 : 420}
                  sottotitolo={tc("sottotitoloTutte", { nome: g.dataset_nome })}
                />
              )}
            </article>
          ))}
        </div>
      </main>
      <footer className="mx-auto w-full max-w-6xl px-4 pb-6 text-xs text-slate-500">
        {t("piede")} · <Link href="/privacy" className="hover:underline">{t("privacy")}</Link>
      </footer>
    </>
  );
}
