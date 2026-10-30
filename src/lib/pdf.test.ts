import { describe, expect, it } from "vitest";
import { pdfDaJpeg } from "./pdf";

const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);
const testo = (u: Uint8Array) => new TextDecoder("latin1").decode(u);

describe("pdf", () => {
  const pdf = testo(pdfDaJpeg(jpeg, 1200, 600, "Pressione è ok", new Date(Date.UTC(2026, 9, 30, 8, 5, 9))));

  it("ha intestazione, fine e tabella degli oggetti con gli scostamenti giusti", () => {
    expect(pdf.startsWith("%PDF-1.4\n")).toBe(true);
    expect(pdf.endsWith("%%EOF\n")).toBe(true);
    const xref = Number(pdf.match(/startxref\n(\d+)/)![1]);
    expect(pdf.slice(xref, xref + 4)).toBe("xref");
    const righe = pdf.slice(xref).split("\n").slice(3, 9);
    righe.forEach((r, i) => expect(pdf.slice(Number(r.slice(0, 10)), Number(r.slice(0, 10)) + 8)).toBe(`${i + 1} 0 obj\n`));
  });

  it("adatta l'immagine alla pagina A4 orizzontale, centrata", () => {
    // 1200×600 in 769,89×523,28 punti: comanda la larghezza.
    expect(pdf).toContain("q 769.89 0 0 384.94 36 105.17 cm /Im0 Do Q");
    expect(pdf).toContain("/Width 1200 /Height 600");
  });

  it("scrive il titolo in UTF-16 e la data", () => {
    expect(pdf).toContain("/Title <FEFF005000720065007300730069006F006E0065002000E80020006F006B>");
    expect(pdf).toContain("/CreationDate (D:20261030080509Z)");
  });
});
