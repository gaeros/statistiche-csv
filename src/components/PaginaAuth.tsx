import Link from "next/link";
import { Logo } from "./Logo";
import { SelettoreLingua } from "./SelettoreLingua";

export function PaginaAuth({ titolo, children }: { titolo: string; children: React.ReactNode }) {
  return (
    <main className="relative flex flex-1 items-center justify-center px-4 py-12">
      <SelettoreLingua className="absolute right-4 top-4" />
      <div className="scheda w-full max-w-sm space-y-6">
        <div className="space-y-1 text-center">
          <Link href="/benvenuto" className="inline-block text-foreground"><Logo className="mx-auto h-16 w-auto" /></Link>
          <h1 className="text-3xl font-semibold tracking-normal">{titolo}</h1>
        </div>
        {children}
      </div>
    </main>
  );
}
