/* eslint-disable @typescript-eslint/no-require-imports -- script Node in CommonJS, fuori dall'app */
// Crea le icone dell'app installabile (public/icone) dal logo in src/app/icon.svg.
// Uso: node scripts/icone-app.cjs (serve Playwright con Chromium).
const { readFileSync } = require("node:fs");
const { chromium } = require("playwright");

const svg = readFileSync("src/app/icon.svg", "utf8");
// Maskable: fondo bianco pieno senza angoli arrotondati e anello più piccolo, così resta
// dentro il cerchio che Android ritaglia (zona sicura = 80% del lato).
const maskable = svg.replace(/rx="44"/, "").replace("scale(0.8)", "scale(0.62)");

const icone = [
  { file: "icona-192.png", lato: 192, svg },
  { file: "icona-512.png", lato: 512, svg },
  { file: "icona-maskable-512.png", lato: 512, svg: maskable },
];

(async () => {
  const browser = await chromium.launch();
  const pagina = await browser.newPage();
  for (const { file, lato, svg: s } of icone) {
    await pagina.setViewportSize({ width: lato, height: lato });
    await pagina.setContent(
      `<style>html,body{margin:0;background:transparent}svg{display:block;width:${lato}px;height:${lato}px}</style>${s}`,
    );
    await pagina.screenshot({ path: `public/icone/${file}`, omitBackground: true });
  }
  await browser.close();
})();
