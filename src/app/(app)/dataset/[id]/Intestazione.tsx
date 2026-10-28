import Link from "next/link";
import { formattaDataOra, formattaNumero } from "@/lib/formato";

type Props = {
  id: string;
  nome: string;
  nomeOriginale: string;
  foglio: string | null;
  createdAt: string;
  righe: number;
  colonne: number;
  attiva: "dati" | "statistiche";
};

export function Intestazione({ id, nome, nomeOriginale, foglio, createdAt, righe, colonne, attiva }: Props) {
  const scheda = (valore: Props["attiva"], href: string, etichetta: string) => (
    <Link
      href={href}
      aria-current={attiva === valore ? "page" : undefined}
      className={`border-b-2 px-1 pb-2 text-sm font-medium ${
        attiva === valore
          ? "border-blue-600 text-blue-700 dark:text-blue-300"
          : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
      }`}
    >
      {etichetta}
    </Link>
  );

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <Link href="/dataset" className="link text-sm">← I miei dataset</Link>
        <h1 className="font-mono text-2xl font-semibold break-all">{nome}</h1>
        <p className="text-sm text-slate-500 break-all">
          {nomeOriginale}
          {foglio ? ` · foglio ${foglio}` : ""} · importato il {formattaDataOra(createdAt)} ·{" "}
          {formattaNumero(righe)} righe · {colonne} colonne
        </p>
      </div>
      <nav className="flex gap-6 border-b border-slate-200 dark:border-slate-800">
        {scheda("dati", `/dataset/${id}`, "Dati")}
        {scheda("statistiche", `/dataset/${id}/statistiche`, "Statistiche")}
      </nav>
    </div>
  );
}
