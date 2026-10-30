// PDF dei grafici esportati: A4 orizzontale, accessibile (PDF/UA-1), scritto a mano per non aggiungere
// una libreria. Prima pagina: titolo, dataset e filtri in testo vero, il grafico come immagine con il
// suo testo alternativo e il piede. Pagine seguenti: i valori del grafico in una tabella di testo.
// Tutto è «taggato» (titolo, paragrafi, figura, tabella) così i lettori di schermo lo leggono in ordine;
// il font (Inter Tight, public/fonts) è incorporato, come chiede lo standard.

const A4_LARGO = 841.89; // punti (1/72 di pollice)
const A4_ALTO = 595.28;
const MARGINE = 36;
const RIGHE_TABELLA_MAX = 2000;

export type CellaPdf = { testo: string; numero?: boolean };

export type DatiPdf = {
  titolo: string;
  sottotitolo?: string;
  piede: string;
  lingua: string; // es. "it-IT"
  alt: string; // testo alternativo del grafico
  // `densita`: pixel dell'immagine per punto del PDF (2 = disegnata a doppia risoluzione). L'immagine si
  // rimpicciolisce per stare nella pagina ma non si ingrandisce oltre, così i testi del grafico restano
  // della stessa misura di quelli del PDF.
  immagine: { jpeg: Uint8Array; larghezza: number; altezza: number; densita?: number };
  tabella: { titolo: string; intestazione: string[]; righe: CellaPdf[][]; nota?: (mostrate: number, totale: number) => string };
  quando?: Date;
};

// --- Font TrueType: quanto serve per scrivere il testo (glifi, larghezze, misure) ---

export type FontPdf = {
  dati: Uint8Array;
  unita: number;
  glifo: (codice: number) => number;
  larghezze: number[];
  ascesa: number;
  discesa: number;
  maiuscole: number;
  riquadro: [number, number, number, number];
};

export function leggiFont(dati: Uint8Array): FontPdf {
  const v = new DataView(dati.buffer, dati.byteOffset, dati.byteLength);
  const tabelle = new Map<string, number>();
  for (let i = 0; i < v.getUint16(4); i++) {
    const r = 12 + i * 16;
    tabelle.set(String.fromCharCode(...dati.subarray(r, r + 4)), v.getUint32(r + 8));
  }
  const t = (nome: string) => {
    const o = tabelle.get(nome);
    if (o === undefined) throw new Error(`Font senza tabella ${nome}`);
    return o;
  };
  const head = t("head");
  const unita = v.getUint16(head + 18);
  const riquadro: [number, number, number, number] = [36, 38, 40, 42].map((d) => v.getInt16(head + d)) as [number, number, number, number];
  const hhea = t("hhea");
  const metriche = v.getUint16(hhea + 34);
  const glifiTotali = v.getUint16(t("maxp") + 4);
  const hmtx = t("hmtx");
  const larghezze: number[] = [];
  for (let g = 0; g < glifiTotali; g++) larghezze.push(v.getUint16(hmtx + 4 * Math.min(g, metriche - 1)));
  const os2 = t("OS/2");

  // cmap formato 4 (Unicode, piano base): segmenti di codici con lo scarto o la tabella dei glifi
  const cmap = t("cmap");
  let sotto = -1;
  for (let i = 0; i < v.getUint16(cmap + 2); i++) {
    const r = cmap + 4 + i * 8;
    const o = cmap + v.getUint32(r + 4);
    if (v.getUint16(o) === 4 && (v.getUint16(r) === 0 || (v.getUint16(r) === 3 && v.getUint16(r + 2) === 1))) sotto = o;
  }
  if (sotto < 0) throw new Error("Font senza cmap Unicode");
  const segmenti = v.getUint16(sotto + 6) / 2;
  const fine = sotto + 14;
  const inizio = fine + segmenti * 2 + 2;
  const delta = inizio + segmenti * 2;
  const scarto = delta + segmenti * 2;
  const glifo = (c: number) => {
    for (let i = 0; i < segmenti; i++) {
      if (c > v.getUint16(fine + i * 2)) continue;
      const da = v.getUint16(inizio + i * 2);
      if (c < da) return 0;
      const s = v.getUint16(scarto + i * 2);
      if (s === 0) return (c + v.getInt16(delta + i * 2)) & 0xffff;
      const g = v.getUint16(scarto + i * 2 + s + (c - da) * 2);
      return g === 0 ? 0 : (g + v.getInt16(delta + i * 2)) & 0xffff;
    }
    return 0;
  };
  return {
    dati,
    unita,
    glifo,
    larghezze,
    ascesa: v.getInt16(hhea + 4),
    discesa: v.getInt16(hhea + 6),
    maiuscole: v.getInt16(os2 + 88),
    riquadro,
  };
}

// Spazi speciali dei numeri formattati (es. migliaia in francese) → spazio normale; caratteri che il
// font non ha → «?» (senza glifo il lettore di schermo leggerebbe comunque il testo giusto, ma a video sparirebbe).
function glifi(f: FontPdf, testo: string): { g: number; c: number }[] {
  return [...testo.replace(/[   ]/g, " ")].map((ch) => {
    const c = ch.codePointAt(0)!;
    const g = f.glifo(c);
    return g ? { g, c } : { g: f.glifo(63), c: 63 };
  });
}

const larghezza = (f: FontPdf, testo: string, corpo: number) =>
  (glifi(f, testo).reduce((s, x) => s + f.larghezze[x.g], 0) / f.unita) * corpo;

function aCapo(f: FontPdf, testo: string, corpo: number, max: number): string[] {
  const righe: string[] = [];
  let riga = "";
  for (const parola of testo.split(/\s+/).filter(Boolean)) {
    const prova = riga ? `${riga} ${parola}` : parola;
    if (riga && larghezza(f, prova, corpo) > max) {
      righe.push(riga);
      riga = parola;
    } else riga = prova;
  }
  if (riga) righe.push(riga);
  return righe;
}

function taglia(f: FontPdf, testo: string, corpo: number, max: number): string {
  if (larghezza(f, testo, corpo) <= max) return testo;
  let t = testo;
  while (t.length > 1 && larghezza(f, `${t}…`, corpo) > max) t = t.slice(0, -1);
  return `${t}…`;
}

// Stringa PDF in UTF-16BE esadecimale (titolo nelle proprietà e attributi dei tag)
function testoPdf(s: string): string {
  let hex = "FEFF";
  for (let i = 0; i < s.length; i++) hex += s.charCodeAt(i).toString(16).padStart(4, "0").toUpperCase();
  return `<${hex}>`;
}

const xml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const n = (x: number) => +x.toFixed(2);

const dataPdf = (d: Date) => {
  const p = (x: number) => String(x).padStart(2, "0");
  return `(D:${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}Z)`;
};

// Elemento della struttura (i «tag»): figli, oppure il contenuto segnato con MCID su una pagina
type Elemento = { tipo: string; figli: Elemento[]; mcid?: number; pagina?: number; alt?: string; attributi?: string };

export function pdfGrafico(d: DatiPdf, fonts: { normale: FontPdf; grassetto: FontPdf }): Uint8Array {
  const quando = d.quando ?? new Date();
  const usati = [new Map<number, number>(), new Map<number, number>()]; // glifo → codice Unicode, per font
  const pagine: { contenuto: string[]; mcid: number; elementi: Elemento[] }[] = [];
  const nuovaPagina = () => {
    pagine.push({ contenuto: [], mcid: 0, elementi: [] });
    return pagine.length - 1;
  };

  // Testo segnato: ogni pezzo di contenuto appartiene a un elemento della struttura, o è un «artefatto»
  // (decorazioni e intestazioni ripetute che il lettore di schermo deve saltare).
  const scrivi = (p: number, el: Elemento | null, testo: string, x: number, y: number, corpo: number, grassetto = false, colore = "0.06 0.09 0.16") => {
    const f = grassetto ? fonts.grassetto : fonts.normale;
    const gl = glifi(f, testo);
    gl.forEach(({ g, c }) => usati[grassetto ? 1 : 0].set(g, c));
    const hex = gl.map(({ g }) => g.toString(16).padStart(4, "0")).join("");
    const disegno = `BT /F${grassetto ? 2 : 1} ${corpo} Tf ${colore} rg ${n(x)} ${n(y)} Td <${hex}> Tj ET`;
    const pg = pagine[p];
    if (el) {
      const mcid = pg.mcid++;
      el.figli.push({ tipo: "MCR", figli: [], mcid, pagina: p });
      pg.contenuto.push(`/${el.tipo} <</MCID ${mcid}>> BDC ${disegno} EMC`);
    } else pg.contenuto.push(`/Artifact BMC ${disegno} EMC`);
  };
  const linea = (p: number, x1: number, y1: number, x2: number, y2: number) =>
    pagine[p].contenuto.push(`/Artifact BMC q 0.89 0.91 0.94 RG 0.75 w ${n(x1)} ${n(y1)} m ${n(x2)} ${n(y2)} l S Q EMC`);

  const documento: Elemento = { tipo: "Document", figli: [] };
  const elemento = (tipo: string, padre: Elemento = documento, extra: Partial<Elemento> = {}) => {
    const el: Elemento = { tipo, figli: [], ...extra };
    padre.figli.push(el);
    return el;
  };
  const largo = A4_LARGO - 2 * MARGINE;

  // Pagina 1: titolo, sottotitolo, grafico, piede
  const p1 = nuovaPagina();
  let y = A4_ALTO - MARGINE - 16;
  const h1 = elemento("H1");
  aCapo(fonts.grassetto, d.titolo, 16, largo).forEach((r) => {
    scrivi(p1, h1, r, MARGINE, y, 16, true);
    y -= 20;
  });
  if (d.sottotitolo) {
    const par = elemento("P");
    aCapo(fonts.normale, d.sottotitolo, 10, largo).forEach((r) => {
      scrivi(p1, par, r, MARGINE, y, 10, false, "0.39 0.45 0.55");
      y -= 14;
    });
  }
  const sopra = y - 4;
  const sotto = MARGINE + 20;
  const { jpeg, larghezza: lw, altezza: lh, densita = 1 } = d.immagine;
  const scala = Math.min(largo / lw, (sopra - sotto) / lh, 1 / densita);
  const w = lw * scala;
  const h = lh * scala;
  const xi = (A4_LARGO - w) / 2;
  const yi = sopra - h;
  const figura = elemento("Figure", documento, { alt: d.alt, attributi: `/A << /O /Layout /BBox [${n(xi)} ${n(yi)} ${n(xi + w)} ${n(sopra)}] >>` });
  {
    const pg = pagine[p1];
    const mcid = pg.mcid++;
    figura.figli.push({ tipo: "MCR", figli: [], mcid, pagina: p1 });
    pg.contenuto.push(`/Figure <</MCID ${mcid}>> BDC q ${n(w)} 0 0 ${n(h)} ${n(xi)} ${n(yi)} cm /Im0 Do Q EMC`);
  }
  scrivi(p1, elemento("P"), d.piede, MARGINE, MARGINE, 9, false, "0.39 0.45 0.55");

  // Pagine seguenti: la tabella dei valori, con l'intestazione ripetuta (come artefatto) su ogni pagina
  const { intestazione, righe: tutte, nota } = d.tabella;
  const righe = tutte.slice(0, RIGHE_TABELLA_MAX);
  const colonne = Math.max(1, intestazione.length);
  const passo = Math.min(largo / colonne, 180);
  const cella = 6;
  const corpo = 10;
  const alto = 17;
  const xTesto = (c: number, testo: string, numero: boolean, f: FontPdf) =>
    numero ? MARGINE + (c + 1) * passo - cella - larghezza(f, testo, corpo) : MARGINE + c * passo + cella;
  const tabella = elemento("Table");
  const intestazioneRiga = (p: number, el: Elemento | null) => {
    intestazione.forEach((h, c) => {
      const numero = c > 0 || !!righe[0]?.[0]?.numero;
      const testo = taglia(fonts.grassetto, h, corpo, passo - 2 * cella);
      const th = el && elemento("TH", el, { attributi: "/A << /O /Table /Scope /Column >>" });
      scrivi(p, th, testo, xTesto(c, testo, numero, fonts.grassetto), y, corpo, true);
    });
    linea(p, MARGINE, y - 6, MARGINE + colonne * passo, y - 6);
    y -= alto + 2;
  };
  let p = nuovaPagina();
  y = A4_ALTO - MARGINE - 13;
  scrivi(p, elemento("H2"), d.tabella.titolo, MARGINE, y, 13, true);
  y -= 26;
  intestazioneRiga(p, elemento("TR", elemento("THead", tabella)));
  const corpoTabella = elemento("TBody", tabella);
  for (const r of righe) {
    if (y < MARGINE + alto) {
      p = nuovaPagina();
      y = A4_ALTO - MARGINE - corpo;
      intestazioneRiga(p, null);
    }
    const tr = elemento("TR", corpoTabella);
    for (let c = 0; c < colonne; c++) {
      const v = r[c] ?? { testo: "" };
      const testo = taglia(fonts.normale, v.testo, corpo, passo - 2 * cella);
      scrivi(p, elemento("TD", tr), testo, xTesto(c, testo, !!v.numero, fonts.normale), y, corpo);
    }
    y -= alto;
  }
  if (nota && tutte.length > righe.length) {
    if (y < MARGINE + alto) {
      p = nuovaPagina();
      y = A4_ALTO - MARGINE - corpo;
    }
    scrivi(p, elemento("P"), nota(righe.length, tutte.length), MARGINE, y - 6, 9, false, "0.39 0.45 0.55");
  }

  // --- Oggetti del file ---
  const enc = new TextEncoder();
  const corpi: { testo: string; flusso?: Uint8Array }[] = [];
  const nuovo = () => corpi.push({ testo: "" });
  const imposta = (id: number, testo: string, flusso?: Uint8Array) => (corpi[id - 1] = { testo, flusso });

  const catalogo = nuovo();
  const albero = nuovo();
  const radiceStruttura = nuovo();
  const genitori = nuovo();
  const metadati = nuovo();
  const info = nuovo();
  const immagine = nuovo();
  const font = [0, 1].map(() => ({ type0: nuovo(), cid: nuovo(), descrittore: nuovo(), file: nuovo(), unicode: nuovo() }));
  const idPagine = pagine.map(() => ({ pagina: nuovo(), contenuto: nuovo() }));

  // Elementi della struttura: un oggetto ciascuno, MCR come riferimenti al contenuto della pagina
  const idElemento = new Map<Elemento, number>();
  const perPagina: number[][] = pagine.map(() => []);
  const registra = (el: Elemento, padre: number) => {
    const id = nuovo();
    idElemento.set(el, id);
    const figli: string[] = [];
    for (const f of el.figli) {
      if (f.tipo === "MCR") {
        figli.push(`<< /Type /MCR /Pg ${idPagine[f.pagina!].pagina} 0 R /MCID ${f.mcid} >>`);
        perPagina[f.pagina!][f.mcid!] = id;
      } else figli.push(`${registra(f, id)} 0 R`);
    }
    const alt = el.alt ? ` /Alt ${testoPdf(el.alt)}` : "";
    imposta(id, `<< /Type /StructElem /S /${el.tipo} /P ${padre} 0 R${alt}${el.attributi ? ` ${el.attributi}` : ""} /K [${figli.join(" ")}] >>`);
    return id;
  };
  const idDocumento = registra(documento, radiceStruttura);

  const lingua = d.lingua.replace(/[^A-Za-z-]/g, "");
  imposta(catalogo, `<< /Type /Catalog /Pages ${albero} 0 R /StructTreeRoot ${radiceStruttura} 0 R /MarkInfo << /Marked true >> /Lang (${lingua}) /ViewerPreferences << /DisplayDocTitle true >> /Metadata ${metadati} 0 R >>`);
  imposta(albero, `<< /Type /Pages /Kids [${idPagine.map((x) => `${x.pagina} 0 R`).join(" ")}] /Count ${pagine.length} >>`);
  imposta(radiceStruttura, `<< /Type /StructTreeRoot /K [${idDocumento} 0 R] /ParentTree ${genitori} 0 R /ParentTreeNextKey ${pagine.length} >>`);
  imposta(genitori, `<< /Nums [${perPagina.map((ids, i) => `${i} [${ids.map((x) => `${x} 0 R`).join(" ")}]`).join(" ")}] >>`);

  const xmp = enc.encode(`<?xpacket begin="﻿" id="W5M0MpCehiHzreSzNTczkc9d"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
<rdf:Description rdf:about="" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:pdf="http://ns.adobe.com/pdf/1.3/" xmlns:xmp="http://ns.adobe.com/xap/1.0/" xmlns:pdfuaid="http://www.aiim.org/pdfua/ns/id/">
<dc:title><rdf:Alt><rdf:li xml:lang="x-default">${xml(d.titolo)}</rdf:li></rdf:Alt></dc:title>
<dc:language><rdf:Bag><rdf:li>${lingua}</rdf:li></rdf:Bag></dc:language>
<pdf:Producer>Datahue</pdf:Producer>
<xmp:CreateDate>${quando.toISOString().replace(/\.\d+Z$/, "Z")}</xmp:CreateDate>
<pdfuaid:part>1</pdfuaid:part>
</rdf:Description></rdf:RDF></x:xmpmeta>
<?xpacket end="w"?>`);
  imposta(metadati, `<< /Type /Metadata /Subtype /XML /Length ${xmp.length} >>`, xmp);
  imposta(info, `<< /Title ${testoPdf(d.titolo)} /Producer (Datahue) /CreationDate ${dataPdf(quando)} >>`);
  imposta(immagine, `<< /Type /XObject /Subtype /Image /Width ${lw} /Height ${lh} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>`, jpeg);

  // Font incorporati: Type0 con identità glifo = codice, larghezze dei glifi usati e mappa Unicode
  [fonts.normale, fonts.grassetto].forEach((f, i) => {
    const id = font[i];
    const nome = i ? "InterTight-SemiBold" : "InterTight-Regular";
    const mille = (x: number) => Math.round((x * 1000) / f.unita);
    const glifiUsati = [...usati[i].keys()].sort((a, b) => a - b);
    const w = glifiUsati.map((g) => `${g} [${mille(f.larghezze[g])}]`).join(" ");
    const hex = (x: number) => x.toString(16).padStart(4, "0").toUpperCase();
    const utf16 = (c: number) => (c > 0xffff ? hex(0xd800 + ((c - 0x10000) >> 10)) + hex(0xdc00 + ((c - 0x10000) & 0x3ff)) : hex(c));
    const mappa = glifiUsati.map((g) => `<${hex(g)}> <${utf16(usati[i].get(g)!)}>`);
    const blocchi: string[] = [];
    for (let k = 0; k < mappa.length; k += 100) blocchi.push(`${mappa.slice(k, k + 100).length} beginbfchar\n${mappa.slice(k, k + 100).join("\n")}\nendbfchar`);
    const cmap = enc.encode(`/CIDInit /ProcSet findresource begin
12 dict begin
begincmap
/CIDSystemInfo << /Registry (Adobe) /Ordering (UCS) /Supplement 0 >> def
/CMapName /Adobe-Identity-UCS def
/CMapType 2 def
1 begincodespacerange
<0000> <FFFF>
endcodespacerange
${blocchi.join("\n")}
endcmap
CMapName currentdict /CMap defineresource pop
end
end`);
    imposta(id.type0, `<< /Type /Font /Subtype /Type0 /BaseFont /${nome} /Encoding /Identity-H /DescendantFonts [${id.cid} 0 R] /ToUnicode ${id.unicode} 0 R >>`);
    imposta(id.cid, `<< /Type /Font /Subtype /CIDFontType2 /BaseFont /${nome} /CIDSystemInfo << /Registry (Adobe) /Ordering (Identity) /Supplement 0 >> /FontDescriptor ${id.descrittore} 0 R /CIDToGIDMap /Identity /DW 1000 /W [${w}] >>`);
    imposta(id.descrittore, `<< /Type /FontDescriptor /FontName /${nome} /Flags 32 /FontBBox [${f.riquadro.map(mille).join(" ")}] /ItalicAngle 0 /Ascent ${mille(f.ascesa)} /Descent ${mille(f.discesa)} /CapHeight ${mille(f.maiuscole)} /StemV ${i ? 120 : 80} /FontFile2 ${id.file} 0 R >>`);
    imposta(id.file, `<< /Length ${f.dati.length} /Length1 ${f.dati.length} >>`, f.dati);
    imposta(id.unicode, `<< /Length ${cmap.length} >>`, cmap);
  });

  pagine.forEach((pg, i) => {
    const contenuto = enc.encode(pg.contenuto.join("\n"));
    imposta(
      idPagine[i].pagina,
      `<< /Type /Page /Parent ${albero} 0 R /MediaBox [0 0 ${A4_LARGO} ${A4_ALTO}] /Resources << /Font << /F1 ${font[0].type0} 0 R /F2 ${font[1].type0} 0 R >>${i === 0 ? ` /XObject << /Im0 ${immagine} 0 R >>` : ""} >> /Contents ${idPagine[i].contenuto} 0 R /StructParents ${i} /Tabs /S >>`,
    );
    imposta(idPagine[i].contenuto, `<< /Length ${contenuto.length} >>`, contenuto);
  });

  // Scrittura: intestazione, oggetti, tabella degli scostamenti, trailer
  const parti: Uint8Array[] = [];
  const offset: number[] = [];
  let lunghezza = 0;
  const aggiungi = (b: Uint8Array | string) => {
    const u = typeof b === "string" ? enc.encode(b) : b;
    parti.push(u);
    lunghezza += u.length;
  };
  aggiungi("%PDF-1.7\n%\xE2\xE3\xCF\xD3\n");
  corpi.forEach((o, i) => {
    offset[i + 1] = lunghezza;
    aggiungi(`${i + 1} 0 obj\n${o.testo}\n`);
    if (o.flusso) {
      aggiungi("stream\n");
      aggiungi(o.flusso);
      aggiungi("\nendstream\n");
    }
    aggiungi("endobj\n");
  });
  const xref = lunghezza;
  aggiungi(`xref\n0 ${corpi.length + 1}\n0000000000 65535 f \n${offset.slice(1).map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("")}`);
  aggiungi(`trailer\n<< /Size ${corpi.length + 1} /Root ${catalogo} 0 R /Info ${info} 0 R >>\nstartxref\n${xref}\n%%EOF\n`);

  const out = new Uint8Array(lunghezza);
  let pos = 0;
  for (const u of parti) {
    out.set(u, pos);
    pos += u.length;
  }
  return out;
}
