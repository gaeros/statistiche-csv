import { getLocale, getTranslations } from "next-intl/server";
import Link from "next/link";
import { creaFormati } from "@/lib/formato";

export type VoceDataset = {
  id: string;
  nome: string;
  nome_originale: string;
  foglio: string | null;
  righe: number;
  colonne: unknown;
  created_at: string;
};

// Elenco dei dataset a righe (non a schede): un clic sul nome porta subito ai grafici.
export async function ElencoDataset({ elenco }: { elenco: VoceDataset[] }) {
  const t = await getTranslations("elenco");
  const f = creaFormati(await getLocale());

  return (
    <ul className="divide-y divide-slate-200 overflow-hidden rounded-3xl border border-slate-200 bg-white dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900">
      {elenco.map((d) => (
        <li key={d.id}>
          <Link
            href={`/dataset/${d.id}/grafici`}
            className="flex flex-wrap items-baseline gap-x-4 gap-y-1 px-5 py-3 hover:bg-slate-50 focus-visible:bg-slate-50 dark:hover:bg-slate-800 dark:focus-visible:bg-slate-800"
          >
            <span className="min-w-0 flex-1 basis-60">
              <span className="block font-mono font-medium break-all">{d.nome}</span>
              <span className="block text-sm text-slate-500 break-all">
                {d.nome_originale}
                {d.foglio ? ` · ${t("foglio", { nome: d.foglio })}` : ""}
              </span>
            </span>
            <span className="text-sm whitespace-nowrap">
              {t("righeColonne", { righe: f.numero(d.righe), colonne: (d.colonne as unknown[]).length })}
            </span>
            <span className="text-xs whitespace-nowrap text-slate-500">{t("importatoIl", { data: f.dataOra(d.created_at) })}</span>
            <span aria-hidden="true" className="text-slate-400">→</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
