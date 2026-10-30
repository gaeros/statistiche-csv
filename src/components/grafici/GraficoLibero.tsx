"use client";

import { useTranslations } from "next-intl";
import { useCallback, useRef } from "react";
import type { ECharts } from "echarts/core";
import { useFormati } from "@/components/FormatiUtente";
import type { Traduttore } from "@/i18n/lingue";
import { csvPreparato, type Preparato } from "@/lib/grafici";
import { pdfDaJpeg } from "@/lib/pdf";
import { Grafico, svgChiaro } from "./Grafico";
import { colori, FONT_GRAFICI, stileAssi, stileTooltip, type Colori } from "./tema";

function scarica(nome: string, url: string) {
  const a = document.createElement("a");
  a.href = url;
  a.download = nome;
  a.click();
}

const nomeFile = (titolo: string, predefinito: string) =>
  titolo.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_|_$/g, "").toLowerCase() || predefinito;

function opzioni(p: Preparato, c: Colori, t: Traduttore) {
  const formatta = c.formatta;
  const assi = stileAssi(c);
  const asseNumeri = (nome: string) => ({
    type: "value" as const,
    name: nome,
    nameTextStyle: { color: c.testoTenue, align: "left" as const },
    scale: p.forma === "dispersione" || p.forma === "box" || (p.forma === "serie" && p.tipo === "linee"),
    ...assi,
    axisLine: { show: false },
  });
  const asseCategorie = (dati: string[]) => ({ type: "category" as const, data: dati, ...assi, splitLine: { show: false } });
  const base = { color: c.serie, grid: { left: 8, right: 24, top: 48, bottom: 8, containLabel: true } };

  switch (p.forma) {
    case "torta":
      return {
        ...base,
        tooltip: {
          trigger: "item",
          ...stileTooltip(c),
          formatter: (x: { name: string; value: number; percent: number }) => `${x.name}: <b>${formatta(x.value)}</b> (${formatta(x.percent)}%)`,
        },
        legend: { bottom: 0, type: "scroll", textStyle: { color: c.testo }, icon: "circle", itemWidth: 10 },
        series: [
          {
            type: "pie",
            radius: ["42%", "70%"],
            center: ["50%", "45%"],
            itemStyle: { borderColor: c.sfondo, borderWidth: 2, borderRadius: 4 },
            label: { color: c.testo, formatter: (x: { name: string; percent: number }) => `${x.name}\n${formatta(x.percent)}%` },
            data: p.fette.slice(0, 8).concat(
              p.fette.length > 8 ? [{ nome: t("altri"), valore: p.fette.slice(8).reduce((s, f) => s + f.valore, 0) }] : [],
            ).map((f) => ({ name: f.nome, value: f.valore })),
          },
        ],
      };
    case "dispersione":
      return {
        ...base,
        tooltip: { trigger: "item", ...stileTooltip(c), formatter: (x: { value: [number, number] }) => `${p.asseX}: <b>${formatta(x.value[0])}</b><br/>${p.asseY}: <b>${formatta(x.value[1])}</b>` },
        xAxis: { ...asseNumeri(p.asseX), nameLocation: "middle" as const, nameGap: 28 },
        yAxis: asseNumeri(p.asseY),
        series: [{ type: "scatter", data: p.punti, symbolSize: 9, itemStyle: { opacity: 0.75, borderColor: c.sfondo, borderWidth: 1 } }],
      };
    case "istogramma":
      return {
        ...base,
        tooltip: { trigger: "axis", axisPointer: { type: "shadow" }, ...stileTooltip(c), valueFormatter: formatta },
        xAxis: asseCategorie(p.categorie),
        yAxis: { ...asseNumeri(p.asseY), minInterval: 1 },
        series: [{ type: "bar", name: t("righe"), data: p.valori, barCategoryGap: "8%", itemStyle: { borderRadius: [4, 4, 0, 0] } }],
      };
    case "box":
      return {
        ...base,
        tooltip: {
          trigger: "item",
          ...stileTooltip(c),
          formatter: (x: { name: string; value: number[] }) => {
            const v = x.value.slice(-5);
            return `${x.name}<br/>${t("massimo")}: <b>${formatta(v[4])}</b><br/>${t("q3")}: <b>${formatta(v[3])}</b><br/>${t("mediana")}: <b>${formatta(v[2])}</b><br/>${t("q1")}: <b>${formatta(v[1])}</b><br/>${t("minimo")}: <b>${formatta(v[0])}</b>`;
          },
        },
        xAxis: asseCategorie(p.categorie),
        yAxis: asseNumeri(p.asseY),
        series: [{ type: "boxplot", data: p.scatole, itemStyle: { color: c.serie[0] + "33", borderColor: c.serie[0], borderWidth: 2 } }],
      };
    case "serie": {
      const impilate = p.tipo === "barre_impilate";
      const linea = p.tipo === "linee" || p.tipo === "area";
      const zoom = p.categorie.length > 40;
      return {
        ...base,
        grid: { ...base.grid, bottom: zoom ? 56 : 8 },
        legend: { show: p.serie.length >= 2, top: 0, left: 0, type: "scroll", textStyle: { color: c.testo }, icon: "circle", itemWidth: 10 },
        tooltip: { trigger: "axis", axisPointer: { type: linea ? "line" : "shadow" }, ...stileTooltip(c), valueFormatter: formatta },
        dataZoom: zoom ? [{ type: "inside" }, { type: "slider", height: 24, bottom: 8 }] : [],
        xAxis: { ...asseCategorie(p.categorie), boundaryGap: !linea },
        yAxis: asseNumeri(p.serie.length === 1 || impilate ? p.asseY : ""),
        series: p.serie.map((s) => ({
          name: s.nome,
          type: linea ? "line" : "bar",
          data: s.valori,
          stack: impilate ? "totale" : undefined,
          areaStyle: p.tipo === "area" ? { opacity: p.serie.length > 1 ? 0.15 : 0.25 } : undefined,
          lineStyle: linea ? { width: 2 } : undefined,
          symbolSize: linea ? 7 : undefined,
          showSymbol: linea ? p.categorie.length <= 60 : undefined,
          connectNulls: false,
          barMaxWidth: 40,
          itemStyle: !linea ? { borderRadius: impilate ? 0 : [4, 4, 0, 0], borderColor: impilate ? c.sfondo : undefined, borderWidth: impilate ? 1 : 0 } : undefined,
          label: !linea && !impilate && p.serie.length === 1 && p.categorie.length <= 12
            ? { show: true, position: "top", color: c.testo, formatter: (x: { value: number | null }) => formatta(x.value) }
            : undefined,
        })),
      };
    }
  }
}

// Va a capo sulle parole perché la riga stia nella larghezza data.
function righe(ctx: CanvasRenderingContext2D, testo: string, larghezza: number): string[] {
  const out: string[] = [];
  let riga = "";
  for (const parola of testo.split(" ")) {
    const prova = riga ? `${riga} ${parola}` : parola;
    if (riga && ctx.measureText(prova).width > larghezza) {
      out.push(riga);
      riga = parola;
    } else riga = prova;
  }
  return riga ? [...out, riga] : out;
}

// Il grafico è in SVG (sempre nei colori chiari, vedi svgChiaro): lo si ridisegna su una tela, con
// sfondo bianco, titolo e sottotitolo (dataset e filtri attivi) sopra e una riga con app e data sotto.
// Serve sia al PNG sia al PDF.
async function disegnaTela(svg: string, titolo: string, sottotitolo: string | undefined, piede: string) {
  const img = new Image();
  img.src = svg;
  await img.decode();
  const scala = 2;
  const lato = 16;
  const tema = colori(false);
  const misura = document.createElement("canvas").getContext("2d")!;
  misura.font = `400 13px ${FONT_GRAFICI}`;
  const sotto = sottotitolo ? righe(misura, sottotitolo, img.width - 2 * lato) : [];
  const sopra = 40 + sotto.length * 18 + 8;
  const fondo = 32;
  const tela = document.createElement("canvas");
  tela.width = img.width * scala;
  tela.height = (img.height + sopra + fondo) * scala;
  const ctx = tela.getContext("2d")!;
  ctx.scale(scala, scala);
  ctx.fillStyle = tema.sfondo;
  ctx.fillRect(0, 0, img.width, img.height + sopra + fondo);
  ctx.fillStyle = tema.testo;
  ctx.font = `600 16px ${FONT_GRAFICI}`;
  ctx.fillText(titolo, lato, 28);
  ctx.fillStyle = tema.testoTenue;
  ctx.font = `400 13px ${FONT_GRAFICI}`;
  sotto.forEach((r, i) => ctx.fillText(r, lato, 48 + i * 18));
  ctx.drawImage(img, 0, sopra);
  ctx.font = `400 11px ${FONT_GRAFICI}`;
  ctx.fillText(piede, lato, sopra + img.height + 20);
  return tela;
}

// Grafico del costruttore, con esportazione in PNG o PDF e dei suoi dati in CSV.
// `sottotitolo` finisce solo nei file esportati: dice da dove vengono i dati e con quali filtri.
export function GraficoLibero({
  titolo,
  preparato,
  altezza = 340,
  sottotitolo,
}: {
  titolo: string;
  preparato: Preparato;
  altezza?: number;
  sottotitolo?: string;
}) {
  const t = useTranslations("chart");
  const tg = useTranslations("grafici");
  const f = useFormati();
  const grafico = useRef<ECharts | null>(null);
  const riferimento = useCallback((g: ECharts | null) => {
    grafico.current = g;
  }, []);
  const vuoto =
    (preparato.forma === "serie" && preparato.categorie.length === 0) ||
    (preparato.forma === "torta" && preparato.fette.length === 0) ||
    (preparato.forma === "dispersione" && preparato.punti.length === 0) ||
    (preparato.forma === "istogramma" && preparato.valori.length === 0) ||
    (preparato.forma === "box" && preparato.scatole.length === 0);

  const opzioniGrafico = (c: Colori) => opzioni(preparato, c, t);

  const tela = async () => {
    const g = grafico.current;
    if (!g) return null;
    const quando = f.dataOra(new Date().toISOString());
    return disegnaTela(await svgChiaro(g, opzioniGrafico, f.localeNumeri), titolo, sottotitolo, t("piede", { quando }));
  };

  async function esportaPng() {
    const c = await tela();
    if (c) scarica(`${nomeFile(titolo, t("grafico"))}.png`, c.toDataURL("image/png"));
  }

  async function esportaPdf() {
    const c = await tela();
    if (!c) return;
    const jpeg = await new Promise<Blob | null>((ok) => c.toBlob(ok, "image/jpeg", 0.92));
    if (!jpeg) return;
    const pdf = pdfDaJpeg(new Uint8Array(await jpeg.arrayBuffer()), c.width, c.height, titolo);
    const url = URL.createObjectURL(new Blob([pdf as BlobPart], { type: "application/pdf" }));
    scarica(`${nomeFile(titolo, t("grafico"))}.pdf`, url);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function esportaCsv() {
    const url = URL.createObjectURL(new Blob([csvPreparato(preparato, tg, f.virgola)], { type: "text/csv;charset=utf-8" }));
    scarica(`${nomeFile(titolo, t("grafico"))}.csv`, url);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  if (vuoto) return <p className="py-8 text-center text-sm text-slate-500">{t("nessunDato")}</p>;

  return (
    <div className="space-y-2">
      <Grafico descrizione={titolo} altezza={altezza} riferimento={riferimento} opzioni={opzioniGrafico} />
      <div className="flex flex-wrap justify-end gap-3 text-sm">
        <button type="button" onClick={esportaPng} className="link">{t("scaricaPng")}</button>
        <button type="button" onClick={esportaPdf} className="link">{t("scaricaPdf")}</button>
        <button type="button" onClick={esportaCsv} className="link">{t("scaricaCsv")}</button>
      </div>
    </div>
  );
}
