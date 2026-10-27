// Barre orizzontali semplici in CSS: i grafici veri arrivano con la Fase 3.
export function Barre({
  righe,
  formattaValore = (n) => n.toLocaleString("it-IT"),
}: {
  righe: { etichetta: string; valore: number | null; nota?: string }[];
  formattaValore?: (n: number) => string;
}) {
  const massimo = Math.max(...righe.map((r) => Math.abs(r.valore ?? 0)), 0);
  return (
    <ul className="space-y-1 text-sm">
      {righe.map((r, i) => (
        <li key={`${r.etichetta}-${i}`} className="grid grid-cols-[minmax(5rem,10rem)_1fr_auto] items-center gap-2">
          <span className="truncate text-slate-600 dark:text-slate-300" title={r.etichetta}>
            {r.etichetta}
          </span>
          <span className="h-3 rounded-sm bg-slate-100 dark:bg-slate-800">
            {r.valore !== null && massimo > 0 && (
              <span
                className="block h-full rounded-sm bg-blue-500"
                style={{ width: `${(Math.abs(r.valore) / massimo) * 100}%` }}
              />
            )}
          </span>
          <span className="min-w-[4.5rem] text-right tabular-nums">
            {r.valore === null ? "–" : formattaValore(r.valore)}
            {r.nota && <span className="ml-1 text-xs text-slate-500">{r.nota}</span>}
          </span>
        </li>
      ))}
    </ul>
  );
}
