"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState, useSyncExternalStore } from "react";

const STANDALONE = "(display-mode: standalone)";
function osservaStandalone(avvisa: () => void) {
  const m = matchMedia(STANDALONE);
  m.addEventListener("change", avvisa);
  return () => m.removeEventListener("change", avvisa);
}

type EventoInstallazione = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

// Pulsante "Installa": compare solo dove il browser lo permette (Chrome, Edge, Android).
// Su iPhone non c'è: lì si usa Condividi → Aggiungi alla schermata Home (spiegato nella Guida).
export function InstallaApp() {
  const t = useTranslations("guidaPagina");
  const [evento, setEvento] = useState<EventoInstallazione | null>(null);
  const [appenaInstallata, setAppenaInstallata] = useState(false);
  // Aperta dall'icona sulla schermata Home (app già installata)
  const standalone = useSyncExternalStore(osservaStandalone, () => matchMedia(STANDALONE).matches, () => false);
  const installata = standalone || appenaInstallata;

  useEffect(() => {
    const pronto = (e: Event) => {
      e.preventDefault();
      setEvento(e as EventoInstallazione);
    };
    const fatto = () => {
      setAppenaInstallata(true);
      setEvento(null);
    };
    window.addEventListener("beforeinstallprompt", pronto);
    window.addEventListener("appinstalled", fatto);
    return () => {
      window.removeEventListener("beforeinstallprompt", pronto);
      window.removeEventListener("appinstalled", fatto);
    };
  }, []);

  if (installata) return <p className="text-sm text-green-800">{t("installata")}</p>;
  if (!evento) return null;
  return (
    <button
      type="button"
      className="bottone"
      onClick={async () => {
        await evento.prompt();
        await evento.userChoice;
        setEvento(null);
      }}
    >
      {t("installa")}
    </button>
  );
}
