"use client";

import { useTranslations } from "next-intl";
import { DatiGrafico } from "./DatiGrafico";
import { Grafico } from "./Grafico";
import { stileAssi, stileTooltip } from "./tema";

// Grafico a barre: verticali (istogrammi, periodi) oppure orizzontali (etichette lunghe).
export function Colonne({
  etichette,
  valori,
  nomeValore,
  descrizione,
  orizzontale = false,
  altezza,
  nomeEtichette,
}: {
  etichette: string[];
  valori: (number | null)[];
  nomeValore: string;
  descrizione: string;
  orizzontale?: boolean;
  altezza?: number;
  // Intestazione della prima colonna nella tabella «Mostra i dati» (predefinita: «Categoria»)
  nomeEtichette?: string;
}) {
  const t = useTranslations("chart");
  const h = altezza ?? (orizzontale ? Math.max(160, etichette.length * 28 + 40) : 240);
  return (
    <div className="space-y-2">
    <Grafico
      descrizione={descrizione}
      altezza={h}
      opzioni={(c) => {
        const categorie = {
          type: "category" as const,
          data: etichette,
          ...stileAssi(c),
          splitLine: { show: false },
          axisLabel: { ...stileAssi(c).axisLabel, width: orizzontale ? 110 : undefined, overflow: "truncate" as const },
          inverse: orizzontale,
        };
        const numeri = {
          type: "value" as const,
          ...stileAssi(c),
          axisLine: { show: false },
          // Conteggi: niente tacche a metà (1,5 righe non esiste)
          minInterval: valori.every((v) => v === null || Number.isInteger(v)) ? 1 : undefined,
        };
        return {
          color: c.serie,
          grid: { left: 8, right: orizzontale ? 40 : 16, top: 20, bottom: 8, containLabel: true },
          tooltip: {
            trigger: "axis",
            axisPointer: { type: "shadow" },
            ...stileTooltip(c),
            formatter: (p: { name: string; value: number | null }[]) =>
              `${p[0].name}<br/>${nomeValore}: <b>${c.formatta(p[0].value)}</b>`,
          },
          xAxis: orizzontale ? numeri : categorie,
          yAxis: orizzontale ? categorie : numeri,
          series: [
            {
              type: "bar",
              data: valori,
              barMaxWidth: 36,
              barCategoryGap: "20%",
              itemStyle: { borderRadius: orizzontale ? [0, 4, 4, 0] : [4, 4, 0, 0] },
              // Con poche barre il valore si legge direttamente sopra (o accanto) a ciascuna.
              label: {
                show: valori.length <= 12,
                position: orizzontale ? "right" : "top",
                color: c.testo,
                formatter: (p: { value: number | null }) => c.formatta(p.value),
              },
            },
          ],
        };
      }}
    />
    <DatiGrafico
      nome={descrizione}
      tabella={() => ({ intestazione: [nomeEtichette ?? t("colCategoria"), nomeValore], righe: etichette.map((e, i) => [e, valori[i]]) })}
    />
    </div>
  );
}
