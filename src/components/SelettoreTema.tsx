"use client";

import { useTranslations } from "next-intl";
import { useSyncExternalStore } from "react";
import { CHIAVE_TEMA, leggiTema, salvaTema, TEMI, type Tema } from "@/lib/tema";

const EVENTO = "datahue-tema";

function osservaScelta(avvisa: () => void) {
  const suStorage = (e: StorageEvent) => {
    if (e.key !== CHIAVE_TEMA) return;
    (window as unknown as { __applicaTema?: () => void }).__applicaTema?.();
    avvisa();
  };
  window.addEventListener(EVENTO, avvisa);
  window.addEventListener("storage", suStorage);
  return () => {
    window.removeEventListener(EVENTO, avvisa);
    window.removeEventListener("storage", suStorage);
  };
}

function osservaHtml(avvisa: () => void) {
  const o = new MutationObserver(avvisa);
  o.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => o.disconnect();
}

// true se la pagina è in tema scuro in questo momento (anche quando "auto" segue il sistema).
export function useTemaScuro() {
  return useSyncExternalStore(osservaHtml, () => document.documentElement.dataset.theme === "dark", () => false);
}

const ICONE: Record<Tema, React.ReactNode> = {
  auto: (
    <>
      <rect x="3" y="4" width="18" height="12" rx="2" />
      <path d="M8 20h8M12 16v4" />
    </>
  ),
  chiaro: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </>
  ),
  scuro: <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" />,
};

// Tre pulsanti (automatico, chiaro, scuro) nello stesso stile del selettore della lingua.
export function SelettoreTema({ className = "" }: { className?: string }) {
  const t = useTranslations("tema");
  // Sul server non si conosce la scelta: si mostra "auto" e si corregge appena carica la pagina.
  const attuale = useSyncExternalStore(osservaScelta, leggiTema, () => "auto" as Tema);
  const scegli = (tema: Tema) => {
    salvaTema(tema);
    window.dispatchEvent(new Event(EVENTO));
  };
  return (
    <div role="group" aria-label={t("etichetta")} className={`inline-flex overflow-hidden rounded-full border border-slate-300 text-sm ${className}`}>
      {TEMI.map((tema) => (
        <button
          key={tema}
          type="button"
          aria-pressed={tema === attuale}
          aria-label={t(tema)}
          title={t(tema)}
          onClick={() => scegli(tema)}
          className={`px-2.5 py-1.5 ${tema === attuale ? "bg-foreground text-white" : "bg-white text-slate-700 hover:bg-slate-100"}`}
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            {ICONE[tema]}
          </svg>
        </button>
      ))}
    </div>
  );
}
