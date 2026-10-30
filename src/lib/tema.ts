// Tema chiaro/scuro. La scelta ("chiaro", "scuro" o "auto" = come il sistema) resta nel browser
// (localStorage, non un cookie). Su <html> data-theme vale sempre "light" o "dark": lo legge il CSS
// (globals.css) e lo leggono i grafici.
export const CHIAVE_TEMA = "datahue-tema";
export const TEMI = ["auto", "chiaro", "scuro"] as const;
export type Tema = (typeof TEMI)[number];

// Colore della barra del browser / dell'app installata, uguale allo sfondo della pagina.
export const COLORE_BARRA = { chiaro: "#ffffff", scuro: "#0f0f12" };

// Gira in testa alla pagina prima che si veda qualcosa, così non lampeggia il tema sbagliato.
// Segue anche i cambi del sistema (es. tramonto sul telefono) finché la scelta è "auto".
export const SCRIPT_TEMA = `(function(){var d=document.documentElement,m=matchMedia("(prefers-color-scheme: dark)");function a(){var s=null;try{s=localStorage.getItem("${CHIAVE_TEMA}")}catch(e){}var k=s==="scuro"||(s!=="chiaro"&&m.matches);d.dataset.theme=k?"dark":"light";var t=document.querySelector('meta[name="theme-color"]');if(t)t.content=k?"${COLORE_BARRA.scuro}":"${COLORE_BARRA.chiaro}"}a();m.addEventListener("change",a);document.addEventListener("DOMContentLoaded",a);window.__applicaTema=a})();`;

export function leggiTema(): Tema {
  try {
    const s = localStorage.getItem(CHIAVE_TEMA);
    return s === "chiaro" || s === "scuro" ? s : "auto";
  } catch {
    return "auto";
  }
}

export function salvaTema(tema: Tema) {
  try {
    if (tema === "auto") localStorage.removeItem(CHIAVE_TEMA);
    else localStorage.setItem(CHIAVE_TEMA, tema);
  } catch {
    /* senza localStorage la scelta vale solo per questa pagina */
    document.documentElement.dataset.theme = tema === "scuro" ? "dark" : "light";
    return;
  }
  (window as unknown as { __applicaTema?: () => void }).__applicaTema?.();
}
