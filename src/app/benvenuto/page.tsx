import { getLocale, getTranslations } from "next-intl/server";
import { Logo } from "@/components/Logo";
import Link from "next/link";
import { Colonne } from "@/components/grafici/Colonne";
import { Linee } from "@/components/grafici/Linee";
import { Torta } from "@/components/grafici/Torta";
import { SelettoreLingua } from "@/components/SelettoreLingua";
import { HeroScorrimento } from "@/components/HeroScorrimento";
import { creaFormati } from "@/lib/formato";
import { createClient } from "@/lib/supabase/server";

export async function generateMetadata() {
  return { title: (await getTranslations("benvenuto"))("metaTitolo") };
}

// Dati inventati, solo per mostrare che aspetto hanno i grafici.
const GIORNI = Array.from({ length: 14 }, (_, i) => `${String(i + 1).padStart(2, "0")}/10`);
const SISTOLICA = [128, 131, 126, 135, 142, 133, 129, 137, 144, 130, 127, 134, 139, 132];
const DIASTOLICA = [82, 84, 80, 86, 91, 85, 81, 88, 92, 83, 80, 86, 89, 84];
const CATEGORIE = [
  { chiave: "catLibri", valore: 14 },
  { chiave: "catCasa", valore: 9 },
  { chiave: "catElettronica", valore: 6 },
  { chiave: "catAbbigliamento", valore: 5 },
  { chiave: "catAltro", valore: 3 },
];
const SPESA = [64, 112, 48, 95, 131, 87];

const PASSI = ["passo1", "passo2", "passo3"];

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
  const t = await getTranslations("benvenuto");
  const f = creaFormati(await getLocale());
  const mesi = [4, 5, 6, 7, 8, 9].map((m) => f.periodo(`2026-${String(m + 1).padStart(2, "0")}-01`, "month").split(" ")[0]);
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  const collegato = !!data.user;

  return (
    <div className="flex flex-1 flex-col bg-white">
      <div className="sticky top-0 z-10 border-b border-slate-100 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <Link href="/benvenuto" className="text-foreground"><Logo className="h-11 w-auto sm:h-14" /></Link>
          <div className="flex items-center gap-3">
            <SelettoreLingua nero />
            <Link href={collegato ? "/dashboard" : "/accedi"} className="bottone-nero">
              {collegato ? t("vaiDati") : t("accedi")}
            </Link>
          </div>
        </div>
      </div>
      <HeroScorrimento a={t("titoloA")} b={t("titoloB")} descrizione={t("titoloAnimazione")} scorri={t("scorri")} />
    <main className="mx-auto w-full max-w-5xl flex-1 space-y-16 px-4 pb-16 pt-4 [&_.scheda]:rounded-3xl [&_.scheda]:border-slate-200 [&_.scheda]:shadow-none">
      <header className="space-y-8 text-center">
        <p className="mx-auto max-w-2xl text-lg text-slate-600 sm:text-2xl">
          {t("intro")}
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <Link href={collegato ? "/dashboard" : "/accedi"} className="bottone-nero bottone-nero-grande">
            {collegato ? t("vaiDati") : t("accedi")}
          </Link>
          {collegato && (
            <Link href="/importa" className="bottone-bordo bottone-nero-grande">
              {t("caricaFile")}
            </Link>
          )}
        </div>
        {!collegato && (
          <p className="text-xs text-slate-500">{t("soloInvito")}</p>
        )}
      </header>

      <section aria-labelledby="come" className="space-y-4">
        <h2 id="come" className="text-3xl font-semibold tracking-normal sm:text-4xl">{t("comeFunziona")}</h2>
        <ol className="grid gap-4 sm:grid-cols-3">
          {PASSI.map((p, i) => (
            <li key={p} className="scheda space-y-1">
              <span className="text-sm font-semibold text-slate-400">{t("passo", { n: i + 1 })}</span>
              <h3 className="font-semibold">{t(`${p}T`)}</h3>
              <p className="text-sm text-slate-600 dark:text-slate-400">{t(p)}</p>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="esempi" className="space-y-4">
        <div className="space-y-1">
          <h2 id="esempi" className="text-3xl font-semibold tracking-normal sm:text-4xl">{t("esempi")}</h2>
          <p className="text-sm text-slate-500">{t("esempiNota")}</p>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <Esempio
            titolo={t("esPressioneT")}
            testo={t("esPressione")}
          >
            <Linee
              etichette={GIORNI}
              serie={[
                { nome: t("massima"), valori: SISTOLICA, soglia: 140 },
                { nome: t("minima"), valori: DIASTOLICA },
              ]}
              descrizione={t("esPressioneD")}
            />
          </Esempio>
          <Esempio
            titolo={t("esOrdiniT")}
            testo={t("esOrdini")}
          >
            <Torta
              fette={CATEGORIE.map((c) => ({ nome: t(c.chiave), valore: c.valore }))}
              descrizione={t("esOrdiniD")}
            />
          </Esempio>
          <div className="lg:col-span-2">
            <Esempio
              titolo={t("esSpesaT")}
              testo={t("esSpesa")}
            >
              <Colonne
                etichette={mesi}
                valori={SPESA}
                nomeValore={t("spesaEuro")}
                descrizione={t("esSpesaD")}
              />
            </Esempio>
          </div>
        </div>
      </section>

      <section aria-labelledby="cosa" className="space-y-4">
        <h2 id="cosa" className="text-3xl font-semibold tracking-normal sm:text-4xl">{t("cosaPuoiFare")}</h2>
        <ul className="grid gap-3 text-sm sm:grid-cols-2">
          {["cosa1", "cosa2", "cosa3", "cosa4"].map((k) => (
            <li key={k} className="scheda">
              {t(k)}
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="privacy" className="scheda space-y-2">
        <h2 id="privacy" className="text-3xl font-semibold tracking-normal sm:text-4xl">{t("privacyT")}</h2>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          {t("privacy")}{" "}
          <Link href="/privacy" className="link">{t("leggiInformativa")}</Link>.
        </p>
      </section>
    </main>
    </div>
  );
}
