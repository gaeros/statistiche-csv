import Link from "next/link";
import { redirect } from "next/navigation";
import { esci } from "@/app/accedi/actions";
import { VERSIONE_INFORMATIVA } from "@/lib/privacy";
import { utenteCorrente } from "@/lib/utente";

export default async function LayoutApp({ children }: LayoutProps<"/">) {
  const { utente, amministratore } = await utenteCorrente();
  if (utente.user_metadata?.consenso_privacy?.versione !== VERSIONE_INFORMATIVA) redirect("/consenso");

  return (
    <>
      <header className="border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
          <Link href="/dataset" className="font-semibold">
            Datahue
          </Link>
          <nav className="flex gap-4 text-sm">
            <Link href="/dataset" className="link">I miei dataset</Link>
            <Link href="/importa" className="link">Importa</Link>
            <Link href="/benvenuto" className="link">Guida</Link>
            {amministratore && (
              <Link href="/admin/inviti" className="link">Inviti</Link>
            )}
          </nav>
          <div className="ml-auto flex items-center gap-3 text-sm">
            <Link href="/account" className="text-slate-500 hover:underline" title="Il mio account">
              <span className="hidden sm:inline">{utente.email}</span>
              <span className="sm:hidden">Account</span>
            </Link>
            <form action={esci}>
              <button type="submit" className="bottone-secondario px-3 py-1 text-sm">Esci</button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full min-w-0 max-w-6xl flex-1 px-4 py-8">{children}</main>
      <footer className="mx-auto w-full max-w-6xl px-4 pb-6 text-xs text-slate-500">
        <Link href="/privacy" className="hover:underline">Informativa privacy</Link> · L&apos;app mostra i tuoi dati e non
        fornisce consigli medici.
      </footer>
    </>
  );
}
