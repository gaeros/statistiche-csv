import Link from "next/link";

// Pulsante di paginazione: sulla prima o sull'ultima pagina resta al suo posto ma spento
// (non cliccabile e fuori dal Tab), così gli altri non si spostano. La freccia non viene letta.
// Con «breve» sul telefono si vede solo la prima parola («Prima»), ma il nome letto resta intero.
export function BottonePagina({ href, freccia, testo, dopo, breve }: { href: string | null; freccia: string; testo: string; dopo?: boolean; breve?: boolean }) {
  const spazio = testo.indexOf(" ");
  const contenuto = (
    <>
      {!dopo && <span aria-hidden="true">{freccia}</span>}
      {breve && spazio > 0 ? (
        <span>{testo.slice(0, spazio)}<span className="max-sm:sr-only">{testo.slice(spazio)}</span></span>
      ) : testo}
      {dopo && <span aria-hidden="true">{freccia}</span>}
    </>
  );
  if (href === null) {
    return (
      <span role="link" aria-disabled="true" className="bottone-secondario pointer-events-none gap-1.5 px-3 py-1 opacity-50">
        {contenuto}
      </span>
    );
  }
  return <Link href={href} className="bottone-secondario gap-1.5 px-3 py-1">{contenuto}</Link>;
}
