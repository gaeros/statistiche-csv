import type { Metadata, Viewport } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getTranslations } from "next-intl/server";
import "@fontsource-variable/inter-tight";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("meta");
  return { title: "Datahue", description: t("descrizione") };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const lingua = await getLocale();
  return (
    <html lang={lingua} className="h-full antialiased">
      {/* Le estensioni del browser (es. ColorZilla) aggiungono attributi al body: non è un errore dell'app */}
      <body className="flex min-h-full flex-col" suppressHydrationWarning>
        <NextIntlClientProvider>{children}</NextIntlClientProvider>
      </body>
    </html>
  );
}
