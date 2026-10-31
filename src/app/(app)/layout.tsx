import { getTranslations } from "next-intl/server";
import { Logo } from "@/components/Logo";
import Link from "next/link";
import { redirect } from "next/navigation";
import { esci } from "@/app/accedi/actions";
import { FormatiUtente } from "@/components/FormatiUtente";
import { MenuAccount } from "@/components/MenuAccount";
import { MenuPrincipale } from "@/components/MenuPrincipale";
import { SelettoreLingua } from "@/components/SelettoreLingua";
import { SelettoreTema } from "@/components/SelettoreTema";
import { leggiPreferenze } from "@/lib/preferenze";
import { VERSIONE_INFORMATIVA } from "@/lib/privacy";
import { utenteCorrente } from "@/lib/utente";

export default async function LayoutApp({ children }: LayoutProps<"/">) {
  const t = await getTranslations("app");
  const { utente, amministratore } = await utenteCorrente();
  if (utente.user_metadata?.consenso_privacy?.versione !== VERSIONE_INFORMATIVA) redirect("/consenso");

  return (
    <>
      {/* Primo elemento raggiungibile col tasto Tab: salta la barra in alto (WCAG 2.4.1) */}
      <a href="#contenuto" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-foreground focus:px-4 focus:py-2 focus:text-white">
        {t("vaiAlContenuto")}
      </a>
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
          <Link href="/dataset">
            <Logo className="h-11 w-auto" />
          </Link>
          <MenuPrincipale
            etichetta={t("menuPrincipale")}
            voci={[
              { href: "/dataset", testo: t("iMieiDataset") },
              { href: "/dashboard", testo: t("dashboard") },
              { href: "/condivisioni", testo: t("condivisi") },
              { href: "/guida", testo: t("guida") },
              ...(amministratore ? [{ href: "/admin/inviti", testo: t("inviti") }] : []),
            ]}
          />
          <div className="ml-auto flex flex-wrap items-center justify-end gap-2 text-sm sm:gap-3">
            <SelettoreTema />
            <SelettoreLingua />
            <form action={esci}>
              <button type="submit" className="bottone-secondario h-9 px-4 py-0 text-sm">{t("esci")}</button>
            </form>
            <MenuAccount email={utente.email ?? ""} />
          </div>
        </div>
      </header>
      <main id="contenuto" tabIndex={-1} className="mx-auto w-full min-w-0 max-w-6xl flex-1 px-4 py-8 focus:outline-none">
        <FormatiUtente preferenze={leggiPreferenze(utente.user_metadata)}>{children}</FormatiUtente>
      </main>
      <footer className="mx-auto w-full max-w-6xl px-4 pb-6 text-xs text-slate-500">
        <Link href="/privacy" className="hover:underline">{t("privacy")}</Link> · {t("nota")}
      </footer>
    </>
  );
}
