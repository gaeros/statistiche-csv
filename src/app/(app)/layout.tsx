import { getTranslations } from "next-intl/server";
import { Logo } from "@/components/Logo";
import Link from "next/link";
import { redirect } from "next/navigation";
import { esci } from "@/app/accedi/actions";
import { SelettoreLingua } from "@/components/SelettoreLingua";
import { VERSIONE_INFORMATIVA } from "@/lib/privacy";
import { utenteCorrente } from "@/lib/utente";

export default async function LayoutApp({ children }: LayoutProps<"/">) {
  const t = await getTranslations("app");
  const { utente, amministratore } = await utenteCorrente();
  if (utente.user_metadata?.consenso_privacy?.versione !== VERSIONE_INFORMATIVA) redirect("/consenso");

  return (
    <>
      <header className="border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
          <Link href="/dataset">
            <Logo className="h-11 w-auto" />
          </Link>
          <nav className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
            <Link href="/dataset" className="link">{t("iMieiDataset")}</Link>
            <Link href="/dashboard" className="link">{t("dashboard")}</Link>
            <Link href="/condivisioni" className="link">{t("condivisi")}</Link>
            <Link href="/guida" className="link">{t("guida")}</Link>
            {amministratore && (
              <Link href="/admin/inviti" className="link">{t("inviti")}</Link>
            )}
          </nav>
          <div className="ml-auto flex items-center gap-3 text-sm">
            <Link href="/account" className="text-slate-500 hover:underline" title={t("account")}>
              <span className="hidden sm:inline">{utente.email}</span>
              <span className="sm:hidden">{t("accountBreve")}</span>
            </Link>
            <SelettoreLingua />
            <form action={esci}>
              <button type="submit" className="bottone-secondario px-3 py-1 text-sm">{t("esci")}</button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full min-w-0 max-w-6xl flex-1 px-4 py-8">{children}</main>
      <footer className="mx-auto w-full max-w-6xl px-4 pb-6 text-xs text-slate-500">
        <Link href="/privacy" className="hover:underline">{t("privacy")}</Link> · {t("nota")}
      </footer>
    </>
  );
}
