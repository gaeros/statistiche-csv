import type { MetadataRoute } from "next";

// Manifest per installare Datahue come app (telefono e computer). Le icone sono in public/icone,
// ricavate dal logo (scripts/icone-app.cjs).
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Datahue",
    short_name: "Datahue",
    description: "Statistiche e grafici dai tuoi file CSV ed Excel",
    id: "/",
    start_url: "/dataset",
    scope: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#ffffff",
    lang: "it",
    icons: [
      { src: "/icone/icona-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icone/icona-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icone/icona-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
