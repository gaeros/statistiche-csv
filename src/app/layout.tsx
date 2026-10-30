import type { Metadata, Viewport } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getTranslations } from "next-intl/server";
import "@fontsource-variable/inter-tight";
import { AvvisoCookie } from "@/components/AvvisoCookie";
import { RegistraServiceWorker } from "@/components/RegistraServiceWorker";
import { COLORE_BARRA, SCRIPT_TEMA } from "@/lib/tema";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("meta");
  return {
    title: "Datahue",
    description: t("descrizione"),
    // App installata sul telefono (manifest in app/manifest.ts)
    appleWebApp: { capable: true, title: "Datahue", statusBarStyle: "default" },
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Lo script del tema lo cambia nel colore scuro quando serve
  themeColor: COLORE_BARRA.chiaro,
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const lingua = await getLocale();
  return (
    // data-theme lo mette lo script prima che React carichi: non è una differenza da segnalare
    <html lang={lingua} className="h-full antialiased" data-theme="light" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: SCRIPT_TEMA }} />
      </head>
      {/* Le estensioni del browser (es. ColorZilla) aggiungono attributi al body: non è un errore dell'app */}
      <body className="flex min-h-full flex-col" suppressHydrationWarning>
        <NextIntlClientProvider>
          {children}
          <AvvisoCookie />
          <RegistraServiceWorker />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
