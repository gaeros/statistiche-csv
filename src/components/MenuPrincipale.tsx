"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Menu della barra in alto: la voce della sezione aperta è annunciata come pagina attuale (aria-current).
export function MenuPrincipale({ etichetta, voci }: { etichetta: string; voci: { href: string; testo: string }[] }) {
  const percorso = usePathname();
  return (
    <nav aria-label={etichetta} className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
      {voci.map((v) => {
        const attiva = percorso === v.href || percorso.startsWith(`${v.href}/`);
        return (
          <Link key={v.href} href={v.href} aria-current={attiva ? "page" : undefined} className={`link ${attiva ? "font-semibold" : ""}`}>
            {v.testo}
          </Link>
        );
      })}
    </nav>
  );
}
