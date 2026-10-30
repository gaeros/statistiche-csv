"use client";

import { useEffect, useRef } from "react";
import { useFormati } from "@/components/FormatiUtente";
import * as echarts from "echarts/core";
import { BarChart, BoxplotChart, LineChart, PieChart, ScatterChart } from "echarts/charts";
import { DataZoomComponent, GridComponent, LegendComponent, MarkLineComponent, TooltipComponent } from "echarts/components";
import { SVGRenderer } from "echarts/renderers";
import { useTemaScuro } from "@/components/SelettoreTema";
import { colori, FONT_GRAFICI, type Colori } from "./tema";

echarts.use([
  BarChart,
  BoxplotChart,
  LineChart,
  PieChart,
  ScatterChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  DataZoomComponent,
  MarkLineComponent,
  SVGRenderer,
]);

// Contenitore comune: crea il grafico ECharts, lo ridimensiona con il riquadro e segue il tema (chiaro/scuro).
// L'altezza si può ingrandire da fuori con la variabile CSS --scala-grafici (es. scheda in primo piano).
export function Grafico({
  opzioni,
  altezza = 280,
  descrizione,
  riferimento,
}: {
  opzioni: (c: Colori) => echarts.EChartsCoreOption;
  altezza?: number;
  descrizione: string;
  // Riceve il grafico ECharts appena creato (null quando viene tolto), es. per esportarlo
  riferimento?: (g: echarts.ECharts | null) => void;
}) {
  const riquadro = useRef<HTMLDivElement>(null);
  const grafico = useRef<echarts.ECharts | null>(null);
  const scuro = useTemaScuro();
  const locale = useFormati().localeNumeri;

  useEffect(() => {
    const el = riquadro.current;
    if (!el) return;
    const g = echarts.init(el, null, { renderer: "svg" });
    grafico.current = g;
    riferimento?.(g);
    const osservatore = new ResizeObserver(() => g.resize());
    osservatore.observe(el);
    return () => {
      osservatore.disconnect();
      riferimento?.(null);
      g.dispose();
      grafico.current = null;
    };
  }, [riferimento]);

  useEffect(() => {
    grafico.current?.setOption({ textStyle: { fontFamily: FONT_GRAFICI }, ...opzioni(colori(scuro, locale)) }, true);
  }, [opzioni, scuro, locale]);

  return <div ref={riquadro} role="img" aria-label={descrizione} style={{ height: `calc(${altezza}px * var(--scala-grafici, 1))` }} className="w-full" />;
}

// SVG del grafico per i file scaricati (PNG/PDF), sempre nei colori chiari: si stampano e si
// mandano ad altri, quindi devono leggersi su carta bianca qualunque tema si stia usando.
// Se a schermo il grafico è già chiaro si usa quello; se è scuro lo si ridisegna fuori schermo,
// con la stessa dimensione, lo stesso zoom e le stesse serie nascoste nella legenda.
export async function svgChiaro(g: echarts.ECharts, opzioni: (c: Colori) => echarts.EChartsCoreOption, locale: string) {
  if (document.documentElement.dataset.theme !== "dark") return g.getDataURL({ type: "svg" });
  const attuale = g.getOption() as { dataZoom?: { start?: number; end?: number }[]; legend?: { selected?: Record<string, boolean> }[] };
  const base = opzioni(colori(false, locale)) as { dataZoom?: object[]; legend?: object };
  const el = document.createElement("div");
  el.style.cssText = `position:fixed;left:-10000px;top:0;width:${g.getWidth()}px;height:${g.getHeight()}px`;
  document.body.appendChild(el);
  const copia = echarts.init(el, null, { renderer: "svg" });
  try {
    copia.setOption({
      animation: false,
      textStyle: { fontFamily: FONT_GRAFICI },
      ...base,
      ...(base.dataZoom?.length && attuale.dataZoom
        ? { dataZoom: base.dataZoom.map((z, i) => ({ ...z, start: attuale.dataZoom?.[i]?.start, end: attuale.dataZoom?.[i]?.end })) }
        : {}),
      ...(base.legend && attuale.legend?.[0]?.selected ? { legend: { ...base.legend, selected: attuale.legend[0].selected } } : {}),
    });
    return copia.getDataURL({ type: "svg" });
  } finally {
    copia.dispose();
    el.remove();
  }
}
