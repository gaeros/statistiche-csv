"use client";

import { Grafico } from "./Grafico";
import { formatta, stileAssi, stileTooltip } from "./tema";

// Andamento nel tempo: una linea per colonna. I periodi senza dati restano vuoti (la linea si interrompe).
// Con una soglia: linea tratteggiata e punti oltre la soglia evidenziati.
const OLTRE = "#dc2626";
export function Linee({
  etichette,
  serie,
  descrizione,
}: {
  etichette: string[];
  serie: { nome: string; valori: (number | null)[]; soglia?: number }[];
  descrizione: string;
}) {
  const zoom = etichette.length > 60;
  const soglie = serie.flatMap((s) => (s.soglia === undefined ? [] : [s.soglia]));
  return (
    <Grafico
      descrizione={descrizione}
      altezza={zoom ? 380 : 340}
      opzioni={(c) => ({
        color: c.serie,
        grid: { left: 8, right: 16, top: serie.length >= 2 ? 40 : 16, bottom: zoom ? 56 : 8, containLabel: true },
        legend: { show: serie.length >= 2, top: 0, left: 0, textStyle: { color: c.testo }, icon: "circle", itemWidth: 10 },
        tooltip: {
          trigger: "axis",
          ...stileTooltip(c),
          valueFormatter: (v: unknown) => formatta(v),
        },
        dataZoom: zoom ? [{ type: "inside" }, { type: "slider", height: 24, bottom: 8 }] : [],
        xAxis: { type: "category", data: etichette, boundaryGap: false, ...stileAssi(c), splitLine: { show: false } },
        yAxis: {
          type: "value",
          scale: true,
          ...stileAssi(c),
          axisLine: { show: false },
          // Le soglie devono restare visibili anche se nessun valore le raggiunge
          // (null = scala automatica, che dà tacche più regolari)
          min: (v: { min: number }) => (soglie.some((x) => x < v.min) ? Math.floor((Math.min(...soglie) - 1) / 10) * 10 : null),
          max: (v: { max: number }) => (soglie.some((x) => x > v.max) ? Math.ceil((Math.max(...soglie) + 1) / 10) * 10 : null),
        },
        series: serie.map((s) => ({
          name: s.nome,
          type: "line",
          data:
            s.soglia === undefined
              ? s.valori
              : s.valori.map((v) =>
                  v !== null && v > s.soglia!
                    ? { value: v, symbolSize: 10, itemStyle: { color: OLTRE, borderColor: c.sfondo, borderWidth: 2 } }
                    : v,
                ),
          markLine:
            s.soglia === undefined
              ? undefined
              : {
                  silent: true,
                  symbol: "none",
                  lineStyle: { type: "dashed", width: 1.5 },
                  label: { formatter: `Soglia ${formatta(s.soglia)}`, color: c.testo, position: "insideEndTop" },
                  data: [{ yAxis: s.soglia }],
                },
          connectNulls: false,
          lineStyle: { width: 2 },
          symbol: "circle",
          symbolSize: 7,
          showSymbol: etichette.length <= 120 || s.soglia !== undefined,
          emphasis: { focus: "series" },
        })),
      })}
    />
  );
}
