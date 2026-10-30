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
  hrefOrdina: (colonna: string, dir: "asc" | "desc") => string;
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
                return (
                  <th
                    key={c.nome}
                    scope="col"
                    aria-sort={attiva ? (discendente ? "descending" : "ascending") : undefined}
                    className={`whitespace-nowrap px-3 py-2.5 font-semibold text-foreground ${
                      numerica(c) ? "text-right" : ""
                    } ${i === 0 ? stickyPrima : ""}`}
                  >
                    <Link
                      href={hrefOrdina(c.nome, attiva && !discendente ? "desc" : "asc")}
                      className="rounded-sm underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground"
                      title={`${c.nome} (${c.tipo})`}
                    >
                      {c.originale}
                      {attiva && <span aria-hidden="true">{discendente ? " ↓" : " ↑"}</span>}
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
