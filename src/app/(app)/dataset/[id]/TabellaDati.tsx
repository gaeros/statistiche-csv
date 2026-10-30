import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { formatiUtente } from "@/lib/utente";

type Colonna = { nome: string; originale: string; tipo: string };

const numerica = (c: Colonna) => c.tipo === "intero" || c.tipo === "decimale";

// Su schermi stretti la prima colonna resta ferma mentre si scorre di lato.
const stickyPrima = "sticky left-0 bg-inherit shadow-[1px_0_0_var(--color-slate-300)] sm:static sm:shadow-none";

// Colonna di testo senza alcun valore in tutto il dataset (valori_colonna non ne trova).
const vuota = (c: Colonna, valori: Record<string, unknown[] | null>) =>
  Array.isArray(valori[c.nome]) && valori[c.nome]!.length === 0;

// Frecce su ogni intestazione: le due frecce chiare dicono che la colonna si può ordinare,
// la freccia scura e spessa dice in che senso è ordinata ora (su = crescente, giù = decrescente).
function FrecceOrdine({ stato }: { stato: "crescente" | "decrescente" | "nessuno" }) {
  const tratto = { fill: "none", stroke: "currentColor", strokeLinecap: "round", strokeLinejoin: "round" } as const;
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5 shrink-0">
      {stato === "nessuno" ? (
        <path d="M7 9.5l5-5 5 5M7 14.5l5 5 5-5" strokeWidth={2.25} className="text-slate-500" {...tratto} />
      ) : (
        <path d={stato === "crescente" ? "M12 20V4M6 10l6-6 6 6" : "M12 4v16M6 14l6 6 6-6"} strokeWidth={3} {...tratto} />
      )}
    </svg>
  );
}

// Tabella delle righe del dataset: le colonne vuote sono nascoste solo qui, i dati restano (e nei file CSV ed Excel).
export async function TabellaDati({
  nome,
  colonne,
  valori,
  righe,
  primaRiga,
  totale,
  ordina,
  discendente,
  hrefOrdina,
}: {
  nome: string;
  colonne: Colonna[];
  valori: Record<string, unknown[] | null>;
  righe: Record<string, unknown>[];
  primaRiga: number;
  totale: number;
  ordina: string;
  discendente: boolean;
  hrefOrdina: (colonna: string, dir: "asc" | "desc" | null) => string;
}) {
  const t = await getTranslations("dettaglio");
  const f = await formatiUtente();
  let nascoste = colonne.filter((c) => vuota(c, valori));
  if (nascoste.length === colonne.length) nascoste = [];
  const mostrate = colonne.filter((c) => !nascoste.includes(c));

  return (
    <>
      <div
        role="region"
        aria-labelledby="didascalia-dati"
        tabIndex={0}
        className="scheda w-fit max-w-full overflow-x-auto overscroll-x-contain p-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground"
      >
        <table className="text-left text-sm">
          <caption id="didascalia-dati" className="sr-only">
            {t("didascalia", {
              nome: nome,
              da: f.numero(righe.length ? primaRiga : 0),
              a: f.numero(righe.length ? primaRiga + righe.length - 1 : 0),
              totale: f.numero(totale),
            })}
          </caption>
          <thead className="border-b-2 border-slate-300">
            <tr className="bg-slate-100">
              {mostrate.map((c, i) => {
                const attiva = ordina === c.nome;
                // Ciclo a ogni clic: crescente → decrescente → ordine originale.
                const prossimo = !attiva ? "asc" : discendente ? null : "desc";
                const stato = attiva ? (discendente ? "decrescente" : "crescente") : "nessuno";
                const azione = prossimo === "asc" ? "ordinaCrescente" : prossimo === "desc" ? "ordinaDecrescente" : "ordineOriginale";
                return (
                  <th
                    key={c.nome}
                    scope="col"
                    aria-sort={attiva ? (discendente ? "descending" : "ascending") : undefined}
                    className={`whitespace-nowrap p-1 font-semibold text-foreground ${
                      numerica(c) ? "text-right" : ""
                    } ${i === 0 ? stickyPrima : ""}`}
                  >
                    <Link
                      href={hrefOrdina(c.nome, prossimo)}
                      className={`inline-flex min-h-10 items-center gap-1.5 rounded-md px-2 py-1.5 hover:bg-slate-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground ${
                        numerica(c) ? "flex-row-reverse" : ""
                      } ${attiva ? "bg-slate-200" : ""}`}
                      title={`${t(azione)} (${c.tipo})`}
                    >
                      <span>{c.originale}</span>
                      <span className="sr-only">
                        {`, ${t(`ordinamento.${stato}`)}. ${t(azione)}`}
                      </span>
                      <FrecceOrdine stato={stato} />
                    </Link>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {righe.map((r) => (
              <tr
                key={String(r.id)}
                className="border-b border-slate-200 bg-white last:border-0 even:bg-slate-50 hover:bg-slate-100 focus-within:bg-slate-100"
              >
                {mostrate.map((c, i) => {
                  const valore = f.valore(r[c.nome], c.tipo);
                  return (
                    <td
                      key={c.nome}
                      title={c.tipo === "testo" && valore.length > 40 ? valore : undefined}
                      className={`max-w-xs truncate whitespace-nowrap px-3 py-2 ${
                        numerica(c) ? "text-right tabular-nums" : ""
                      } ${i === 0 ? stickyPrima : ""}`}
                    >
                      {valore}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {nascoste.length > 0 && (
        <p className="text-sm text-slate-600">
          {t("colonneNascoste", { n: nascoste.length, nomi: nascoste.map((c) => c.originale).join(", ") })}
        </p>
      )}
    </>
  );
}
