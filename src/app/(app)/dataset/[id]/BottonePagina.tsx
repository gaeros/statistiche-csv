import Link from "next/link";

// Pulsante di paginazione con la sola freccia: il nome («Prima pagina», «Precedente»…) lo leggono
// i lettori di schermo e compare passandoci sopra col mouse. Sulla prima o sull'ultima pagina resta
// al suo posto ma spento (non cliccabile e fuori dal Tab), così gli altri non si spostano.
export function BottonePagina({ href, freccia, testo }: { href: string | null; freccia: string; testo: string }) {
  const classi = "bottone-secondario h-9 min-w-9 px-2 py-0 text-base";
  if (href === null) {
    return (
      <span role="link" aria-disabled="true" aria-label={testo} title={testo} className={`${classi} pointer-events-none opacity-40`}>
        <span aria-hidden="true">{freccia}</span>
      </span>
    );
  }
  return (
    <Link href={href} aria-label={testo} title={testo} className={classi}>
      <span aria-hidden="true">{freccia}</span>
    </Link>
  );
}
