import Link from "next/link";
import { esci } from "@/app/accedi/actions";
import { utenteCorrente } from "@/lib/utente";

export default async function LayoutApp({ children }: LayoutProps<"/">) {
  const { utente, amministratore } = await utenteCorrente();

  return (
    <>
      <header className="border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
          <Link href="/dataset" className="font-semibold">
            Statistiche da CSV
          </Link>
          <nav className="flex gap-4 text-sm">
            <Link href="/dataset" className="link">I miei dataset</Link>
            {amministratore && (
              <Link href="/admin/inviti" className="link">Inviti</Link>
            )}
          </nav>
          <div className="ml-auto flex items-center gap-3 text-sm">
            <span className="hidden text-slate-500 sm:inline">{utente.email}</span>
            <form action={esci}>
              <button type="submit" className="bottone-secondario px-3 py-1 text-sm">Esci</button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">{children}</main>
    </>
  );
}
