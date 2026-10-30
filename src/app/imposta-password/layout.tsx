import { getTranslations } from "next-intl/server";

// La pagina è un componente client: il titolo della scheda del browser si imposta qui.
export async function generateMetadata() {
  return { title: `${(await getTranslations("impostaPassword"))("titolo")} – Datahue` };
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
