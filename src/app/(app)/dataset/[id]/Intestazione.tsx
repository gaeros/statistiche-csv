import { getLocale, getTranslations } from "next-intl/server";
import Link from "next/link";
import { creaFormati } from "@/lib/formato";

type Props = {
  id: string;
  nome: string;
  nomeOriginale: string;
  foglio: string | null;
  createdAt: string;
  righe: number;
  colonne: number;
  attiva: "dati" | "statistiche" | "grafici";
  // Filtri attivi ("?f.data.p=30..."), mantenuti passando da una scheda all'altra
  query?: string;
};

export async function Intestazione({ id, nome, nomeOriginale, foglio, createdAt, righe, colonne, attiva, query = "" }: Props) {
  const t = await getTranslations("dettaglio");
  const f = creaFormati(await getLocale());
  const scheda = (valore: Props["attiva"], href: string, etichetta: string) => (
    <Link
      href={href}
      aria-current={attiva === valore ? "page" : undefined}
      className={`border-b-2 px-1 pb-2 text-sm font-medium ${
        attiva === valore
          ? "border-foreground text-foreground dark:text-blue-300"
          : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
      }`}
    >
      {etichetta}
    </Link>
  );

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <Link href="/dataset" className="link text-sm">{t("tornaElenco")}</Link>
        <h1 className="font-mono text-3xl font-semibold tracking-normal break-all">{nome}</h1>
        <p className="text-sm text-slate-500 break-all">
          {nomeOriginale}
          {foglio ? ` · ${t("foglio", { nome: foglio })} · ` : " · "}
          {t("info", { data: f.dataOra(createdAt), righe: f.numero(righe), colonne })}
        </p>
      </div>
      <nav className="flex gap-6 border-b border-slate-200 dark:border-slate-800">
        {scheda("dati", `/dataset/${id}${query}`, t("schedaDati"))}
        {scheda("statistiche", `/dataset/${id}/statistiche${query}`, t("schedaStatistiche"))}
        {scheda("grafici", `/dataset/${id}/grafici${query}`, t("schedaGrafici"))}
      </nav>
    </div>
  );
}
