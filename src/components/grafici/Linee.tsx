"use client";

import { Grafico } from "./Grafico";
import { formatta, stileAssi, stileTooltip } from "./tema";

// Andamento nel tempo: una linea per colonna. I periodi senza dati restano vuoti (la linea si interrompe).
export function Linee({
  etichette,
  serie,
  descrizione,
}: {
  etichette: string[];
  serie: { nome: string; valori: (number | null)[] }[];
  descrizione: string;
}) {
  const zoom = etichette.length > 60;
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
        yAxis: { type: "value", scale: true, ...stileAssi(c), axisLine: { show: false } },
        series: serie.map((s) => ({
          name: s.nome,
          type: "line",
          data: s.valori,
          connectNulls: false,
          lineStyle: { width: 2 },
          symbol: "circle",
          symbolSize: 7,
          showSymbol: etichette.length <= 120,
          emphasis: { focus: "series" },
        })),
      })}
    />
  );
}
