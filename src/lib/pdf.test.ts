import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { leggiFont, pdfGrafico } from "./pdf";

const font = (nome: string) => leggiFont(new Uint8Array(readFileSync(`public/fonts/InterTight-${nome}.ttf`)));
const fonts = { normale: font("Regular"), grassetto: font("SemiBold") };
const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);
const testo = (u: Uint8Array) => new TextDecoder("latin1").decode(u);

const crea = (righe: number) =>
  testo(
    pdfGrafico(
      {
        titolo: "Pressione è ok",
        sottotitolo: "Dataset «pressione» · tutte le righe",
        piede: "Datahue · esportato il 30/10/2026",
        lingua: "it-IT",
        alt: "Grafico a linee della pressione",
        immagine: { jpeg, larghezza: 1200, altezza: 600 },
        tabella: {
          titolo: "Dati del grafico",
          intestazione: ["Mese", "Sistolica"],
          righe: Array.from({ length: righe }, (_, i) => [{ testo: `mese ${i + 1}` }, { testo: String(120 + i), numero: true }]),
          nota: (m, t) => `Prime ${m} righe di ${t}`,
        },
        quando: new Date(Date.UTC(2026, 9, 30, 8, 5, 9)),
      },
      fonts,
    ),
  );

describe("leggiFont", () => {
  it("trova glifi e larghezze, anche di accenti, virgolette e euro", () => {
    const f = fonts.normale;
    expect(f.unita).toBe(2048);
    for (const ch of "aèé«»–€") expect(f.glifo(ch.codePointAt(0)!)).toBeGreaterThan(0);
    // Valori controllati con fontTools
    expect([f.glifo(48), f.larghezze[f.glifo(48)]]).toEqual([243, 1184]);
    expect([f.glifo(0xe8), f.larghezze[f.glifo(0xe8)]]).toEqual([152, 1092]);
    expect([f.glifo(0x20ac), f.larghezze[f.glifo(0x20ac)]]).toEqual([334, 1266]);
  });
});

describe("pdfGrafico", () => {
  const pdf = crea(3);

  it("ha intestazione, fine e tabella degli oggetti con gli scostamenti giusti", () => {
    expect(pdf.startsWith("%PDF-1.7\n")).toBe(true);
    expect(pdf.endsWith("%%EOF\n")).toBe(true);
    const xref = Number(pdf.match(/startxref\n(\d+)/)![1]);
    expect(pdf.slice(xref, xref + 4)).toBe("xref");
    const quanti = Number(pdf.slice(xref).match(/^xref\n0 (\d+)/)![1]);
    const righe = pdf.slice(xref).split("\n").slice(3, 2 + quanti);
    righe.forEach((r, i) => expect(pdf.slice(Number(r.slice(0, 10)), Number(r.slice(0, 10)) + `${i + 1} 0 obj`.length)).toBe(`${i + 1} 0 obj`));
  });

  it("è dichiarato accessibile: tag, lingua, titolo mostrato, PDF/UA nei metadati", () => {
    expect(pdf).toContain("/MarkInfo << /Marked true >>");
    expect(pdf).toContain("/Lang (it-IT)");
    expect(pdf).toContain("/DisplayDocTitle true");
    expect(pdf).toContain("<pdfuaid:part>1</pdfuaid:part>");
    expect(pdf).toContain("Pressione è ok</rdf:li>".replace("è", "\xC3\xA8"));
    expect(pdf).toContain("/Tabs /S");
  });

  it("ha la struttura: titolo, figura con testo alternativo, tabella con intestazioni", () => {
    for (const tag of ["/S /Document", "/S /H1", "/S /P", "/S /Figure", "/S /H2", "/S /Table", "/S /THead", "/S /TBody", "/S /TR", "/S /TH", "/S /TD"]) {
      expect(pdf).toContain(tag);
    }
    expect(pdf).toContain("/Scope /Column");
    expect(pdf).toMatch(/\/S \/Figure \/P \d+ 0 R \/Alt <FEFF0047/);
  });

  it("incorpora i font con la mappa Unicode per copiare e leggere il testo", () => {
    expect(pdf).toContain("/FontFile2");
    expect(pdf).toContain("/ToUnicode");
    expect(pdf).toContain("<00E8>"); // è
    expect(pdf).not.toContain("/BaseFont /Helvetica");
  });

  it("mette il grafico in alto e la tabella dalla seconda pagina; righe lunghe vanno su più pagine", () => {
    expect(pdf).toContain("/Count 2");
    expect(pdf).toMatch(/\/Figure <<\/MCID \d+>> BDC q [\d.]+ 0 0 [\d.]+ [\d.]+ [\d.]+ cm \/Im0 Do Q EMC/);
    const lungo = crea(80);
    expect(Number(lungo.match(/\/Count (\d+)/)![1])).toBeGreaterThan(3);
    // L'intestazione ripetuta sulle pagine successive è un artefatto: il lettore di schermo non la ripete
    expect(lungo).toMatch(/\/Artifact BMC BT \/F2/);
  });
});
