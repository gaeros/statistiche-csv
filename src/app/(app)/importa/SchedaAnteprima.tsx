"use client";

import { creaAnteprima, type ColonnaAnteprima } from "@/lib/import/anteprima";
import type { DatasetEsistente, Modalita } from "@/lib/import/carica";
import type { Foglio } from "@/lib/import/lettura";
import { converti, ETICHETTE_TIPO, mancante, type Tipo } from "@/lib/import/tipi";
import type { Scheda } from "./Importatore";

const TIPI = Object.keys(ETICHETTE_TIPO) as Tipo[];
const RIGHE_ANTEPRIMA = 20;

function nonConvertibili(righe: string[][], c: ColonnaAnteprima): number {
  if (c.tipo === "testo") return 0;
  let n = 0;
  for (const r of righe) {
    const v = r[c.indice] ?? "";
    if (!mancante(v) && converti(v, c.tipo, c.formatoNumero) === null) n++;
  }
  return n;
}

export function SchedaAnteprima({
  scheda,
  foglio,
  nomeFile,
  esistente,
  altriNomi,
  onChange,
}: {
  scheda: Scheda;
  foglio: Foglio;
  nomeFile: string;
  esistente?: DatasetEsistente;
  altriNomi: string[];
  onChange: (s: Scheda) => void;
}) {
  const a = scheda.anteprima;
  const incluse = a.colonne.filter((c) => c.includi);

  const ricrea = (opzioni: { rigaIntestazione?: number; senzaIntestazione?: boolean }) => {
    const nuova = creaAnteprima(foglio, nomeFile, {
      rigaIntestazione: opzioni.rigaIntestazione ?? a.rigaIntestazione,
      senzaIntestazione: opzioni.senzaIntestazione ?? a.senzaIntestazione,
    });
    onChange({ ...scheda, anteprima: { ...nuova, nomeTabella: a.nomeTabella } });
  };

  const modificaColonna = (indice: number, modifica: Partial<ColonnaAnteprima>) =>
    onChange({
      ...scheda,
      anteprima: { ...a, colonne: a.colonne.map((c) => (c.indice === indice ? { ...c, ...modifica } : c)) },
    });

  return (
    <div className="space-y-4 rounded-lg border border-slate-200 p-4 dark:border-slate-800">
      {a.foglio && <h3 className="font-medium">Foglio: {a.foglio}</h3>}

      <div className="grid gap-4 sm:grid-cols-[2fr_1fr]">
        <label className="block space-y-1">
          <span className="text-sm font-medium">Nome della tabella</span>
          <input
            className="campo font-mono"
            value={a.nomeTabella}
            maxLength={53}
            onChange={(e) => onChange({ ...scheda, anteprima: { ...a, nomeTabella: e.target.value.toLowerCase() } })}
          />
          {altriNomi.includes(a.nomeTabella) && (
            <span className="text-xs text-amber-700 dark:text-amber-300">Un altro foglio ha lo stesso nome.</span>
          )}
        </label>
        <label className="block space-y-1">
          <span className="text-sm font-medium">Intestazioni nella riga</span>
          <input
            type="number"
            min={1}
            max={Math.max(1, foglio.righe.length)}
            className="campo"
            value={a.rigaIntestazione}
            onChange={(e) => ricrea({ rigaIntestazione: Math.max(1, Number(e.target.value) || 1) })}
          />
        </label>
      </div>

      {a.intestazioneSospetta && (
        <div className="flex flex-wrap items-center gap-3 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
          La prima riga sembra contenere dati, non intestazioni.
          <button type="button" className="underline" onClick={() => ricrea({ senzaIntestazione: true })}>
            Usa colonna_1, colonna_2, …
          </button>
        </div>
      )}

      {esistente && (
        <fieldset className="space-y-2 rounded-md border border-blue-200 bg-blue-50 p-3 text-sm dark:border-blue-900 dark:bg-blue-950/40">
          <legend className="px-1 font-medium">Hai già un dataset chiamato {esistente.nome}</legend>
          {(
            [
              ["nuova", `Crea un nuovo dataset (${a.nomeTabella}_2)`],
              ["sostituisci", "Sostituisci il dataset esistente"],
              ["accoda", "Accoda le righe al dataset esistente"],
            ] as [Modalita, string][]
          ).map(([valore, etichetta]) => (
            <label key={valore} className="flex items-center gap-2">
              <input
                type="radio"
                name={`modalita-${scheda.chiave}-${nomeFile}`}
                checked={scheda.modalita === valore}
                onChange={() => onChange({ ...scheda, modalita: valore, confermaSostituzione: false })}
              />
              {etichetta}
            </label>
          ))}
          {scheda.modalita === "sostituisci" && (
            <label className="ml-6 flex items-center gap-2 text-red-700 dark:text-red-300">
              <input
                type="checkbox"
                checked={scheda.confermaSostituzione}
                onChange={(e) => onChange({ ...scheda, confermaSostituzione: e.target.checked })}
              />
              Confermo: i dati attuali di {esistente.nome} verranno eliminati.
            </label>
          )}
        </fieldset>
      )}

      {a.avvisi.length > 0 && (
        <ul className="list-inside list-disc text-sm text-amber-700 dark:text-amber-300">
          {a.avvisi.map((x) => (
            <li key={x}>{x}</li>
          ))}
        </ul>
      )}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="text-slate-500">
            <tr>
              <th className="py-1 pr-2 font-medium">Importa</th>
              <th className="py-1 pr-2 font-medium">Nel file</th>
              <th className="py-1 pr-2 font-medium">Nome nel database</th>
              <th className="py-1 pr-2 font-medium">Tipo</th>
              <th className="py-1 font-medium">Note</th>
            </tr>
          </thead>
          <tbody>
            {a.colonne.map((c) => {
              const errati = c.includi ? nonConvertibili(a.righe, c) : 0;
              return (
                <tr key={c.indice} className="border-t border-slate-100 align-top dark:border-slate-800">
                  <td className="py-1.5 pr-2">
                    <input
                      type="checkbox"
                      checked={c.includi}
                      onChange={(e) => modificaColonna(c.indice, { includi: e.target.checked })}
                      aria-label={`Importa ${c.originale}`}
                    />
                  </td>
                  <td className="py-1.5 pr-2">{c.originale}</td>
                  <td className="py-1.5 pr-2">
                    <input
                      className="campo py-1 font-mono text-sm"
                      value={c.nome}
                      maxLength={63}
                      disabled={!c.includi}
                      onChange={(e) => modificaColonna(c.indice, { nome: e.target.value.toLowerCase() })}
                    />
                  </td>
                  <td className="py-1.5 pr-2">
                    <select
                      className="campo py-1 text-sm"
                      value={c.tipo}
                      disabled={!c.includi}
                      onChange={(e) => modificaColonna(c.indice, { tipo: e.target.value as Tipo })}
                    >
                      {TIPI.map((t) => (
                        <option key={t} value={t}>
                          {ETICHETTE_TIPO[t]}
                          {t === c.tipoRilevato ? " (rilevato)" : ""}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="py-1.5 text-xs text-slate-500">
                    {c.avvisi.map((x) => (
                      <div key={x}>{x}</div>
                    ))}
                    {c.mancanti > 0 && !c.vuota && <div>{c.mancanti.toLocaleString("it-IT")} valori mancanti</div>}
                    {errati > 0 && (
                      <div className="text-amber-700 dark:text-amber-300">
                        {errati.toLocaleString("it-IT")} valori non convertibili: resteranno vuoti
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <details open>
        <summary className="cursor-pointer text-sm font-medium">
          Prime {Math.min(RIGHE_ANTEPRIMA, a.righe.length)} righe di {a.righe.length.toLocaleString("it-IT")}
        </summary>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 dark:bg-slate-800/50">
              <tr>
                {incluse.map((c) => (
                  <th key={c.indice} className="whitespace-nowrap px-2 py-1 font-medium">
                    {c.originale}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {a.righe.slice(0, RIGHE_ANTEPRIMA).map((r, i) => (
                <tr key={i} className="border-t border-slate-100 dark:border-slate-800">
                  {incluse.map((c) => (
                    <td key={c.indice} className="max-w-[16rem] truncate whitespace-nowrap px-2 py-1">
                      {r[c.indice] ?? ""}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
