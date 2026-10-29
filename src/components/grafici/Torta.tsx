"use client";

import { Grafico } from "./Grafico";
import { SERIE_CHIARO, stileTooltip } from "./tema";

// Grafico a ciambella: per poche categorie (al massimo 8 fette, le altre vanno raccolte in "Altri").
export function Torta({ fette, descrizione }: { fette: { nome: string; valore: number }[]; descrizione: string }) {
  const totale = fette.reduce((s, f) => s + f.valore, 0);
  const percentuale = (v: number) => (totale ? Math.round((v / totale) * 100) : 0);
  // Con nomi lunghi la legenda diventa un elenco, una voce per riga.
  const elenco = fette.some((f) => f.nome.length > 20);
  // La legenda è HTML sotto il grafico: con nomi lunghi va a capo senza finire sopra la torta.
  return (
    <div className="space-y-3">
    <Grafico
      descrizione={descrizione}
      altezza={220}
      opzioni={(c) => ({
        color: c.serie,
        tooltip: {
          trigger: "item",
          ...stileTooltip(c),
          formatter: (p: { name: string; value: number; percent: number }) =>
            `${p.name}: <b>${c.formatta(p.value)}</b> (${c.formatta(p.percent)}%)`,
        },
        series: [
          {
            type: "pie",
            radius: ["45%", "85%"],
            center: ["50%", "50%"],
            avoidLabelOverlap: true,
            itemStyle: { borderColor: c.sfondo, borderWidth: 2, borderRadius: 4 },
            // Percentuale scritta dentro la fetta; sulle fette troppo piccole basta il tooltip.
            label: {
              position: "inside",
              color: "#ffffff",
              fontWeight: "bold",
              formatter: (p: { value: number }) => (percentuale(p.value) >= 6 ? `${percentuale(p.value)}%` : ""),
            },
            labelLine: { show: false },
            data: fette.map((f) => ({ name: f.nome, value: f.valore })),
          },
        ],
      })}
    />
    {fette.length >= 2 && (
      <ul className={`flex gap-x-4 gap-y-1 text-sm ${elenco ? "flex-col" : "flex-wrap justify-center"}`}>
        {fette.map((f, i) => (
          <li key={f.nome} className="flex max-w-full min-w-0 items-baseline gap-1.5">
            <span
              aria-hidden="true"
              className="inline-block size-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: SERIE_CHIARO[i % SERIE_CHIARO.length] }}
            />
            <span className="min-w-0 break-words">{f.nome}</span>
            <span className={`shrink-0 text-slate-500 tabular-nums ${elenco ? "ml-auto pl-2" : ""}`}>{percentuale(f.valore)}%</span>
          </li>
        ))}
      </ul>
    )}
    </div>
  );
}
