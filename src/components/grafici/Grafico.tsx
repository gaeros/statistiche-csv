"use client";

import { useLocale } from "next-intl";
import { useEffect, useRef } from "react";
import { LOCALE_INTL, LINGUA_BASE, èLingua } from "@/i18n/lingue";
import * as echarts from "echarts/core";
import { BarChart, BoxplotChart, LineChart, PieChart, ScatterChart } from "echarts/charts";
import { DataZoomComponent, GridComponent, LegendComponent, MarkLineComponent, TooltipComponent } from "echarts/components";
import { SVGRenderer } from "echarts/renderers";
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

// Contenitore comune: crea il grafico ECharts, lo ridimensiona con il riquadro e usa il tema chiaro.
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
  const scuro = false; // l'app usa solo il tema chiaro
  const lingua = useLocale();
  const locale = LOCALE_INTL[èLingua(lingua) ? lingua : LINGUA_BASE];

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

  return <div ref={riquadro} role="img" aria-label={descrizione} style={{ height: altezza }} className="w-full" />;
}
