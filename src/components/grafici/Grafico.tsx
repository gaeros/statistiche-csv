"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import * as echarts from "echarts/core";
import { BarChart, LineChart, PieChart } from "echarts/charts";
import { DataZoomComponent, GridComponent, LegendComponent, TooltipComponent } from "echarts/components";
import { SVGRenderer } from "echarts/renderers";
import { colori, type Colori } from "./tema";

echarts.use([BarChart, LineChart, PieChart, GridComponent, TooltipComponent, LegendComponent, DataZoomComponent, SVGRenderer]);

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
}: {
  opzioni: (c: Colori) => echarts.EChartsCoreOption;
  altezza?: number;
  descrizione: string;
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
    const osservatore = new ResizeObserver(() => g.resize());
    osservatore.observe(el);
    return () => {
      osservatore.disconnect();
      g.dispose();
      grafico.current = null;
    };
  }, []);

  useEffect(() => {
    grafico.current?.setOption(opzioni(colori(scuro)), true);
  }, [opzioni, scuro]);

  return <div ref={riquadro} role="img" aria-label={descrizione} style={{ height: altezza }} className="w-full" />;
}
