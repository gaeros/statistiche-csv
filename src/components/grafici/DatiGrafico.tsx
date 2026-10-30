"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { useFormati } from "@/components/FormatiUtente";
import type { TabellaGrafico } from "@/lib/grafici";

// Oltre questo numero di righe la tabella sotto il grafico si ferma: le altre sono nel CSV.
const MAX_RIGHE_TABELLA = 500;

// «Mostra i dati»: gli stessi numeri del grafico in una tabella, per chi usa un lettore di schermo
// o non distingue i colori (WCAG 1.1.1). Le righe si calcolano e si disegnano solo quando la si apre.
export function DatiGrafico({ nome, tabella }: { nome: string; tabella: () => TabellaGrafico }) {
  const t = useTranslations("chart");
  const f = useFormati();
  const [aperta, setAperta] = useState(false);
  const { intestazione, righe } = aperta ? tabella() : { intestazione: [], righe: [] };
  const valore = (x: string | number | null) => (x === null ? "–" : typeof x === "number" ? f.valore(x, "decimale") : x);

  return (
    <details className="text-sm" onToggle={(e) => setAperta(e.currentTarget.open)}>
      <summary className="cursor-pointer text-slate-600 hover:text-foreground">{t("mostraDati")}</summary>
      {aperta && (
        <div className="mt-2 max-h-80 overflow-auto rounded-xl border border-slate-200" tabIndex={0} role="region" aria-label={t("datiDi", { titolo: nome })}>
          <table className="w-full text-left">
            <caption className="sr-only">{t("datiDi", { titolo: nome })}</caption>
            <thead className="sticky top-0 bg-slate-100">
              <tr>
                {intestazione.map((h, i) => (
                  <th key={i} scope="col" className={`px-3 py-1.5 font-medium ${i > 0 || typeof righe[0]?.[0] === "number" ? "text-right" : ""}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {righe.slice(0, MAX_RIGHE_TABELLA).map((r, i) => (
                <tr key={i} className="border-t border-slate-100">
                  {r.map((x, j) =>
                    j === 0 && typeof x === "string" ? (
                      <th key={j} scope="row" className="px-3 py-1 font-normal">{x}</th>
                    ) : (
                      <td key={j} className="px-3 py-1 text-right tabular-nums">{valore(x)}</td>
                    ),
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          {righe.length > MAX_RIGHE_TABELLA && (
            <p className="px-3 py-2 text-slate-500">{t("primeRighe", { n: f.numero(MAX_RIGHE_TABELLA), totale: f.numero(righe.length) })}</p>
          )}
        </div>
      )}
    </details>
  );
}
