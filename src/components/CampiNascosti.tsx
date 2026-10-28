import type { Parametri } from "@/lib/filtri";

// Ripete nel modulo i parametri dell'indirizzo che il modulo non cambia (altre scelte, filtri...).
export function CampiNascosti({ sp, tieni }: { sp: Parametri; tieni: (chiave: string) => boolean }) {
  return Object.entries(sp)
    .filter(([k]) => tieni(k))
    .flatMap(([k, v]) => (Array.isArray(v) ? v : v === undefined ? [] : [v]).map((x, i) => ({ k, x, i })))
    .map(({ k, x, i }) => <input key={`${k}-${i}`} type="hidden" name={k} value={x} />);
}
