// PDF di una sola pagina A4 orizzontale con un'immagine JPEG al centro (i grafici esportati).
// Scritto a mano per non aggiungere una libreria: un PDF con un'immagine sono sei oggetti.

const A4_LARGO = 841.89; // punti (1/72 di pollice)
const A4_ALTO = 595.28;
const MARGINE = 36;

// Stringa PDF in UTF-16BE esadecimale, così il titolo può avere accenti e qualsiasi carattere.
function testoPdf(s: string): string {
  let hex = "FEFF";
  for (let i = 0; i < s.length; i++) hex += s.charCodeAt(i).toString(16).padStart(4, "0").toUpperCase();
  return `<${hex}>`;
}

const data = (d: Date) => {
  const p = (n: number) => String(n).padStart(2, "0");
  return `(D:${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}Z)`;
};

// `larghezza` e `altezza` sono i pixel dell'immagine: servono solo per le proporzioni.
export function pdfDaJpeg(jpeg: Uint8Array, larghezza: number, altezza: number, titolo = "", quando = new Date()): Uint8Array {
  const scala = Math.min((A4_LARGO - 2 * MARGINE) / larghezza, (A4_ALTO - 2 * MARGINE) / altezza);
  const w = +(larghezza * scala).toFixed(2);
  const h = +(altezza * scala).toFixed(2);
  const x = +((A4_LARGO - w) / 2).toFixed(2);
  const y = +((A4_ALTO - h) / 2).toFixed(2);
  const disegno = `q ${w} 0 0 ${h} ${x} ${y} cm /Im0 Do Q`;

  const enc = new TextEncoder();
  const parti: Uint8Array[] = [];
  const offset: number[] = [];
  let lunghezza = 0;
  const aggiungi = (b: Uint8Array | string) => {
    const u = typeof b === "string" ? enc.encode(b) : b;
    parti.push(u);
    lunghezza += u.length;
  };
  const oggetto = (n: number, corpo: string, flusso?: Uint8Array) => {
    offset[n] = lunghezza;
    aggiungi(`${n} 0 obj\n${corpo}\n`);
    if (flusso) {
      aggiungi("stream\n");
      aggiungi(flusso);
      aggiungi("\nendstream\n");
    }
    aggiungi("endobj\n");
  };

  aggiungi("%PDF-1.4\n%\xE2\xE3\xCF\xD3\n");
  oggetto(1, "<< /Type /Catalog /Pages 2 0 R >>");
  oggetto(2, "<< /Type /Pages /Kids [3 0 R] /Count 1 >>");
  oggetto(3, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${A4_LARGO} ${A4_ALTO}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>`);
  oggetto(
    4,
    `<< /Type /XObject /Subtype /Image /Width ${larghezza} /Height ${altezza} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>`,
    jpeg,
  );
  oggetto(5, `<< /Length ${enc.encode(disegno).length} >>`, enc.encode(disegno));
  oggetto(6, `<< /Title ${testoPdf(titolo)} /Producer (Datahue) /CreationDate ${data(quando)} >>`);

  const xref = lunghezza;
  aggiungi(`xref\n0 7\n0000000000 65535 f \n${offset.slice(1).map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("")}`);
  aggiungi(`trailer\n<< /Size 7 /Root 1 0 R /Info 6 0 R >>\nstartxref\n${xref}\n%%EOF\n`);

  const out = new Uint8Array(lunghezza);
  let p = 0;
  for (const u of parti) {
    out.set(u, p);
    p += u.length;
  }
  return out;
}
