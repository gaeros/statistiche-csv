// Titolo della pagina di benvenuto: i numeri si trasformano in barre di un grafico, in ciclo.
// Solo CSS (vedi globals.css); con "riduci movimento" resta tutto fermo e leggibile.

const NUMERI = ["128", "131", "126", "142", "135", "139", "144"];
const ALTEZZE = [42, 52, 36, 76, 58, 68, 84]; // % dell'altezza disponibile

export function TitoloAnimato({ a, b, descrizione }: { a: string; b: string; descrizione: string }) {
  return (
    <div className="space-y-5">
      <div aria-hidden className="anim-trasforma mx-auto flex h-28 items-end justify-center gap-3 sm:gap-4">
        {NUMERI.map((n, i) => (
          <div key={i} className="relative h-full w-9 sm:w-11" style={{ ["--h" as string]: `${ALTEZZE[i]}%`, ["--i" as string]: i }}>
            <span className="anim-numero absolute inset-x-0 bottom-2 text-center font-mono text-base font-semibold text-slate-400 sm:text-lg">{n}</span>
            <div className="anim-barra absolute inset-x-0 bottom-0 rounded-t-md bg-black" />
          </div>
        ))}
      </div>
      <h1 className="text-5xl font-semibold leading-[1.05] tracking-tighter sm:text-7xl md:text-8xl">
        <span className="sr-only">{descrizione}</span>
        <span aria-hidden className="block text-slate-400">{a}</span>
        <span aria-hidden className="anim-freccia my-1 block text-3xl text-black sm:text-4xl">↓</span>
        <span aria-hidden className="text-black">{b}</span>
      </h1>
    </div>
  );
}
