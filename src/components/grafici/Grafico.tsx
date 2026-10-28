"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import * as echarts from "echarts/core";
import { BarChart, BoxplotChart, LineChart, PieChart, ScatterChart } from "echarts/charts";
import { DataZoomComponent, GridComponent, LegendComponent, MarkLineComponent, TooltipComponent } from "echarts/components";
import { SVGRenderer } from "echarts/renderers";
import { colori, type Colori } from "./tema";

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

const scuroQuery = "(prefers-color-scheme: dark)";

function iscriviTema(avvisa: () => void) {
  const mq = window.matchMedia(scuroQuery);
  mq.addEventListener("change", avvisa);
  return () => mq.removeEventListener("change", avvisa);
}

// Contenitore comune: crea il grafico ECharts, lo ridimensiona con il riquadro e segue il tema chiaro/scuro.
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
  const scuro = useSyncExternalStore(
    iscriviTema,
    () => window.matchMedia(scuroQuery).matches,
    () => false,
  );

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
    grafico.current?.setOption(opzioni(colori(scuro)), true);
  }, [opzioni, scuro]);

  return <div ref={riquadro} role="img" aria-label={descrizione} style={{ height: altezza }} className="w-full" />;
}
