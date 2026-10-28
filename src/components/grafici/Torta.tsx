"use client";

import { Grafico } from "./Grafico";
import { stileTooltip } from "./tema";

// Grafico a ciambella: per poche categorie (al massimo 8 fette, le altre vanno raccolte in "Altri").
export function Torta({ fette, descrizione }: { fette: { nome: string; valore: number }[]; descrizione: string }) {
  const totale = fette.reduce((s, f) => s + f.valore, 0);
  const percentuale = (v: number) => (totale ? Math.round((v / totale) * 100) : 0);
  const legenda = new Map(fette.map((f) => [f.nome, `${f.nome}  ${percentuale(f.valore)}%`]));
  return (
    <Grafico
      descrizione={descrizione}
      altezza={260}
      opzioni={(c) => ({
        color: c.serie,
        tooltip: {
          trigger: "item",
          ...stileTooltip(c),
          formatter: (p: { name: string; value: number; percent: number }) =>
            `${p.name}: <b>${c.formatta(p.value)}</b> (${c.formatta(p.percent)}%)`,
        },
        legend: {
          show: fette.length >= 2,
          bottom: 0,
          textStyle: { color: c.testo },
          icon: "circle",
          itemWidth: 10,
          formatter: (nome: string) => legenda.get(nome) ?? nome,
        },
        series: [
          {
            type: "pie",
            radius: ["42%", "72%"],
            center: ["50%", "44%"],
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
  );
}
