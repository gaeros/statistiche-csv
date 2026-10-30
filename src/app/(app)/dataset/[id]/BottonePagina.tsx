import Link from "next/link";

// Disegni delle frecce (24×24, tratto spesso): «« prima pagina, ← precedente, → successiva.
const FRECCE = {
  prima: "M11 17l-5-5 5-5M18 17l-5-5 5-5",
  precedente: "M19 12H5M11 18l-6-6 6-6",
  successiva: "M5 12h14M13 6l6 6-6 6",
};

// Pulsante di paginazione con la sola freccia: il nome («Prima pagina», «Precedente»…) lo leggono
// i lettori di schermo e compare passandoci sopra col mouse. Sulla prima o sull'ultima pagina resta
// al suo posto ma spento (non cliccabile e fuori dal Tab), così gli altri non si spostano.
export function BottonePagina({ href, freccia, testo }: { href: string | null; freccia: keyof typeof FRECCE; testo: string }) {
  const classi = "bottone-secondario h-10 w-10 border-2 p-0";
  const icona = (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2.75} strokeLinecap="round" strokeLinejoin="round">
      <path d={FRECCE[freccia]} />
    </svg>
  );
  if (href === null) {
    return (
      <span role="link" aria-disabled="true" aria-label={testo} title={testo} className={`${classi} pointer-events-none border-slate-200 text-slate-300`}>
        {icona}
      </span>
    );
  }
  return (
    <Link href={href} aria-label={testo} title={testo} className={`${classi} border-slate-400`}>
      {icona}
    </Link>
  );
}
