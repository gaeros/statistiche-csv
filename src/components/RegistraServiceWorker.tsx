"use client";

import { useEffect } from "react";

// Registra public/sw.js, che serve solo per installare l'app e mostrare una pagina "sei offline".
// Non salva pagine né dati: vedi il commento in sw.js. In sviluppo non si registra.
export function RegistraServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch(() => {
      /* senza service worker l'app funziona lo stesso, solo non si installa */
    });
  }, []);
  return null;
}
