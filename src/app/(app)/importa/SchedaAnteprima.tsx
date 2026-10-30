"use client";

import { useTranslations } from "next-intl";
import { useId, useMemo, useState } from "react";
import { tradotto, type Traduttore } from "@/i18n/lingue";
import { useFormati } from "@/components/FormatiUtente";
import type { Formati } from "@/lib/formato";
import {
  avvisiColonna,
  conforme,
  creaAnteprima,
  nonConformi,
  valoreCorretto,
  type Anteprima,
  type ColonnaAnteprima,
  type SeNonConforme,
  type ValoreNonConforme,
} from "@/lib/import/anteprima";
import type { DatasetEsistente, Modalita } from "@/lib/import/carica";
import type { Foglio } from "@/lib/import/lettura";
import { mancante, TIPI_DATO, type FormatoNumero, type Tipo } from "@/lib/import/tipi";
import type { Scheda } from "./Importatore";

const RIGHE_ANTEPRIMA = 20;
const VALORI_MOSTRATI = 30; // valori diversi da correggere mostrati per colonna
const RIGHE_PER_VALORE = 5; // numeri di riga elencati per ogni valore

const numerico = (tipo: Tipo) => tipo === "intero" || tipo === "decimale";

function Passo({ n, titolo, id }: { n: number; titolo: string; id?: string }) {
  return (
    <h4 id={id} className="flex items-center gap-2 font-medium">
      <span aria-hidden className="grid size-6 place-content-center rounded-full bg-foreground text-xs text-white">
        {n}
      </span>
      {titolo}
    </h4>
  );
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
  const t = useTranslations("importa");
  const f = useFormati();
  const idBase = useId();
  const [soloDaControllare, setSoloDaControllare] = useState(false);
  const a = scheda.anteprima;
  const incluse = a.colonne.filter((c) => c.includi);

  // Per ogni colonna: i valori non validi nel file (prima delle correzioni) e quelli che restano tali.
  const problemi = useMemo(
    () =>
      new Map(
        a.colonne.map((c) => {
          const nelFile = nonConformi(a, c, true);
          const restano = nelFile.filter((e) => !conforme(e.valore, c));
          return [c.indice, { nelFile, restano }] as const;
        }),
      ),
    [a],
  );
  const colonneConProblemi = a.colonne.filter((c) => (problemi.get(c.indice)?.nelFile.length ?? 0) > 0);
  const suggerite = a.colonne.filter((c) => c.includi && c.tipoSuggerito && c.tipo === "testo");
  const righeDaControllare = useMemo(() => {
    const s = new Set<number>();
    for (const { nelFile } of problemi.values()) for (const e of nelFile) e.righe.forEach((i) => s.add(i));
    return s;
  }, [problemi]);

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

  const idProblemi = (c: ColonnaAnteprima) => `${idBase}-nc-${c.indice}`;
  const indiciAnteprima = (
    soloDaControllare ? a.righe.map((_, i) => i).filter((i) => righeDaControllare.has(i)) : a.righe.map((_, i) => i)
  ).slice(0, RIGHE_ANTEPRIMA);
  const totaleAnteprima = soloDaControllare ? righeDaControllare.size : a.righe.length;

  return (
    <div className="space-y-6 rounded-lg border border-slate-200 p-4">
      {a.foglio && <h3 className="font-semibold">{t("foglioTitolo", { nome: a.foglio })}</h3>}

      {/* 1. Tabella e intestazioni */}
      <section className="space-y-4" aria-labelledby={`${idBase}-p1`}>
        <Passo n={1} titolo={t("passoStruttura")} id={`${idBase}-p1`} />
        <div className="grid gap-4 sm:grid-cols-[2fr_1fr]">
          <label className="block space-y-1">
            <span className="text-sm font-medium">{t("nomeTabella")}</span>
            <input
              className="campo font-mono"
              value={a.nomeTabella}
              maxLength={53}
              onChange={(e) => onChange({ ...scheda, anteprima: { ...a, nomeTabella: e.target.value.toLowerCase() } })}
            />
            {altriNomi.includes(a.nomeTabella) && <span className="text-xs text-amber-700">{t("altroFoglio")}</span>}
          </label>
          <label className="block space-y-1">
            <span className="text-sm font-medium">{t("rigaIntestazioni")}</span>
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
          <div className="flex flex-wrap items-center gap-3 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            {t("sospetta")}
            <button type="button" className="underline" onClick={() => ricrea({ senzaIntestazione: true })}>
              {t("usaColonne")}
            </button>
          </div>
        )}

        {esistente && (
          <fieldset className="space-y-2 rounded-md border border-slate-300 bg-slate-100 p-3 text-sm">
            <legend className="px-1 font-medium">{t("esistente", { nome: esistente.nome })}</legend>
            {(
              [
                ["nuova", t("modNuova", { nome: a.nomeTabella })],
                ["sostituisci", t("modSostituisci")],
                ["accoda", t("modAccoda")],
                ["accodaNuove", t("modAccodaNuove")],
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
            {scheda.modalita === "accodaNuove" && <p className="ml-6 text-slate-600">{t("accodaNuoveNota")}</p>}
            {scheda.modalita === "sostituisci" && (
              <label className="ml-6 flex items-center gap-2 text-red-700">
                <input
                  type="checkbox"
                  checked={scheda.confermaSostituzione}
                  onChange={(e) => onChange({ ...scheda, confermaSostituzione: e.target.checked })}
                />
                {t("confermoSost", { nome: esistente.nome })}
              </label>
            )}
          </fieldset>
        )}

        {a.avvisi.length > 0 && (
          <ul className="list-inside list-disc text-sm text-amber-700">
            {a.avvisi.map((x) => {
              const testo = tradotto(t, x);
              return <li key={testo}>{testo}</li>;
            })}
          </ul>
        )}
      </section>

      {/* 2. Colonne e tipi */}
      <section className="space-y-3" aria-labelledby={`${idBase}-p2`}>
        <Passo n={2} titolo={t("passoColonne")} id={`${idBase}-p2`} />
        <p className="text-sm text-slate-600">{t("passoColonneAiuto")}</p>
        <div className="relative overflow-x-auto">
          <table className="w-full min-w-[680px] text-left text-sm">
            <thead className="text-slate-500">
              <tr>
                <th className="py-1 pr-2 font-medium">{t("thImporta")}</th>
                <th className="py-1 pr-2 font-medium">{t("thNelFile")}</th>
                <th className="py-1 pr-2 font-medium">{t("thNomeDb")}</th>
                <th className="py-1 pr-2 font-medium">{t("thTipo")}</th>
                <th className="py-1 font-medium">{t("thNote")}</th>
              </tr>
            </thead>
            <tbody>
              {a.colonne.map((c) => {
                const p = problemi.get(c.indice);
                const daCorreggere = p?.restano.reduce((n, e) => n + e.righe.length, 0) ?? 0;
                const corretti = (p?.nelFile.length ?? 0) - (p?.restano.length ?? 0);
                return (
                  <tr key={c.indice} className="border-t border-slate-100 align-top">
                    <td className="py-1.5 pr-2">
                      <input
                        type="checkbox"
                        checked={c.includi}
                        onChange={(e) => modificaColonna(c.indice, { includi: e.target.checked })}
                        aria-label={t("ariaImporta", { nome: c.originale })}
                      />
                    </td>
                    <td className="py-1.5 pr-2">{c.originale}</td>
                    <td className="py-1.5 pr-2">
                      <input
                        className="campo py-1 font-mono text-sm"
                        value={c.nome}
                        maxLength={63}
                        disabled={!c.includi}
                        aria-label={t("ariaNomeDb", { nome: c.originale })}
                        onChange={(e) => modificaColonna(c.indice, { nome: e.target.value.toLowerCase() })}
                      />
                    </td>
                    <td className="space-y-1 py-1.5 pr-2">
                      <select
                        className="campo py-1 text-sm"
                        value={c.tipo}
                        disabled={!c.includi}
                        aria-label={t("ariaTipo", { nome: c.originale })}
                        onChange={(e) => modificaColonna(c.indice, { tipo: e.target.value as Tipo })}
                      >
                        {TIPI_DATO.map((tipo) => (
                          <option key={tipo} value={tipo}>
                            {t(`tipo_${tipo}`)}
                            {tipo === c.tipoRilevato ? t("rilevato") : ""}
                          </option>
                        ))}
                      </select>
                      {c.includi && numerico(c.tipo) && (
                        <select
                          className="campo py-1 text-xs"
                          value={c.formatoNumero}
                          aria-label={t("ariaFormatoNumeri", { nome: c.originale })}
                          onChange={(e) => modificaColonna(c.indice, { formatoNumero: e.target.value as FormatoNumero })}
                        >
                          <option value="it">{t("formatoIt")}</option>
                          <option value="en">{t("formatoEn")}</option>
                        </select>
                      )}
                    </td>
                    <td className="py-1.5 text-xs text-slate-500">
                      {avvisiColonna(c).map((x) => {
                        const testo = tradotto(t, x);
                        return <div key={testo}>{testo}</div>;
                      })}
                      {c.mancanti > 0 && !c.vuota && <div>{t("valoriMancanti", { n: f.numero(c.mancanti) })}</div>}
                      {daCorreggere > 0 && (
                        <a href={`#${idProblemi(c)}`} className="font-medium text-red-700 underline">
                          {t("daControllare", { n: daCorreggere })}
                        </a>
                      )}
                      {daCorreggere === 0 && corretti > 0 && <div className="text-green-800">{t("tuttiCorretti")}</div>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* 3. Valori da controllare */}
      <section className="space-y-3" aria-labelledby={`${idBase}-p3`}>
        <Passo n={3} titolo={t("passoValori")} id={`${idBase}-p3`} />
        {suggerite.length > 0 && (
          <ul className="space-y-2">
            {suggerite.map((c) => (
              <li
                key={c.indice}
                className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900"
              >
                <span>{t("quasiTutti", { nome: c.originale, tipo: t(`tipo_${c.tipoSuggerito}`) })}</span>
                <button
                  type="button"
                  className="bottone-secondario py-1.5 text-sm"
                  onClick={() => modificaColonna(c.indice, { tipo: c.tipoSuggerito })}
                >
                  {t("usaSuggerito", { tipo: t(`tipo_${c.tipoSuggerito}`) })}
                </button>
              </li>
            ))}
          </ul>
        )}
        {colonneConProblemi.length === 0 ? (
          suggerite.length === 0 && (
            <p className="rounded-md border border-green-300 bg-green-50 px-3 py-2 text-sm text-green-800">{t("tuttiValidi")}</p>
          )
        ) : (
          <>
            <p className="text-sm text-slate-600">{t("passoValoriAiuto")}</p>
            {colonneConProblemi.map((c) => (
              <ValoriColonna
                key={c.indice}
                id={idProblemi(c)}
                colonna={c}
                anteprima={a}
                elenco={problemi.get(c.indice)!.nelFile}
                onChange={(modifica) => modificaColonna(c.indice, modifica)}
                t={t}
                f={f}
              />
            ))}
          </>
        )}
      </section>

      {/* Anteprima delle righe */}
      <details open>
        <summary className="cursor-pointer text-sm font-medium">
          {t("prime", { a: indiciAnteprima.length, b: f.numero(totaleAnteprima) })}
        </summary>
        {righeDaControllare.size > 0 && (
          <label className="mt-2 flex items-center gap-2 text-sm">
            <input type="checkbox" checked={soloDaControllare} onChange={(e) => setSoloDaControllare(e.target.checked)} />
            {t("soloDaControllare", { n: f.numero(righeDaControllare.size) })}
          </label>
        )}
        <div className="relative mt-2 overflow-x-auto">
          <table className="w-full text-left text-xs">
            <caption className="sr-only">{t("didascaliaAnteprima")}</caption>
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th scope="col" className="whitespace-nowrap px-2 py-1 font-medium">
                  {t("thRiga")}
                </th>
                {incluse.map((c) => (
                  <th key={c.indice} scope="col" className="whitespace-nowrap px-2 py-1 font-medium">
                    {c.originale}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {indiciAnteprima.map((i) => (
                <tr key={i} className="border-t border-slate-100">
                  <th scope="row" className="px-2 py-1 font-normal text-slate-500">
                    {a.numeriRiga[i]}
                  </th>
                  {incluse.map((c) => (
                    <Cella key={c.indice} grezzo={a.righe[i][c.indice] ?? ""} colonna={c} t={t} />
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

function Cella({ grezzo, colonna, t }: { grezzo: string; colonna: ColonnaAnteprima; t: Traduttore }) {
  const base = "max-w-[16rem] truncate whitespace-nowrap px-2 py-1";
  const v = valoreCorretto(grezzo, colonna);
  if (!conforme(grezzo, colonna)) {
    return (
      <td className={`${base} bg-red-50 font-medium text-red-800`} title={t("cellaNonValida")}>
        <span aria-hidden>⚠ </span>
        {grezzo}
        <span className="sr-only"> ({t("cellaNonValida")})</span>
      </td>
    );
  }
  if (v !== grezzo) {
    return (
      <td className={`${base} bg-green-50 text-green-900`} title={t("cellaCorretta", { valore: grezzo })}>
        <span aria-hidden>✎ </span>
        {mancante(v) ? t("vuoto") : v}
        <span className="sr-only"> ({t("cellaCorretta", { valore: grezzo })})</span>
      </td>
    );
  }
  return <td className={base}>{grezzo}</td>;
}

function ValoriColonna({
  id,
  colonna: c,
  anteprima: a,
  elenco,
  onChange,
  t,
  f,
}: {
  id: string;
  colonna: ColonnaAnteprima;
  anteprima: Anteprima;
  elenco: ValoreNonConforme[];
  onChange: (m: Partial<ColonnaAnteprima>) => void;
  t: Traduttore;
  f: Formati;
}) {
  const tipo = t(`tipo_${c.tipo}`);
  const restano = elenco.filter((e) => !conforme(e.valore, c));
  const occorrenze = restano.reduce((n, e) => n + e.righe.length, 0);
  const mostrati = elenco.slice(0, VALORI_MOSTRATI);

  const correggi = (valore: string, nuovo: string) => {
    const correzioni = { ...c.correzioni };
    if (nuovo === "") delete correzioni[valore];
    else correzioni[valore] = nuovo;
    onChange({ correzioni });
  };

  const righe = (e: ValoreNonConforme) => {
    const numeri = e.righe.slice(0, RIGHE_PER_VALORE).map((i) => f.numero(a.numeriRiga[i]));
    const altre = e.righe.length - numeri.length;
    return altre > 0 ? t("righeEAltre", { righe: numeri.join(", "), n: altre }) : t("righeElenco", { righe: numeri.join(", "), n: e.righe.length });
  };

  return (
    <fieldset
      id={id}
      tabIndex={-1}
      className={`space-y-3 rounded-md border p-3 text-sm ${
        occorrenze > 0 ? "border-amber-300 bg-amber-50" : "border-green-300 bg-green-50"
      }`}
    >
      <legend className="px-1 font-medium">
        {c.originale} · {tipo}
      </legend>
      <p role="status" className={occorrenze > 0 ? "text-amber-900" : "text-green-800"}>
        {occorrenze > 0 ? t("valoriNonValidi", { n: occorrenze, tipo }) : t("tuttiCorretti")}
      </p>

      <ul className="space-y-2">
        {mostrati.map((e, k) => {
          const correzione = c.correzioni[e.valore] ?? "";
          const ok = conforme(e.valore, c);
          const idStato = `${id}-v${k}`;
          return (
            <li key={e.valore} className="grid items-center gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
              <div className="min-w-0">
                <span className="break-all font-mono font-medium">«{e.valore}»</span>{" "}
                <span className="text-xs text-slate-600">{righe(e)}</span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  className="campo py-1 text-sm"
                  value={correzione}
                  placeholder={t("correggiSegnaposto")}
                  aria-label={t("ariaCorreggi", { valore: e.valore })}
                  aria-describedby={correzione ? idStato : undefined}
                  aria-invalid={correzione !== "" && !ok}
                  onChange={(ev) => correggi(e.valore, ev.target.value)}
                />
                {correzione !== "" && (
                  <span id={idStato} className={`shrink-0 text-xs ${ok ? "text-green-800" : "text-red-700"}`}>
                    {ok ? t("correzioneOk") : t("correzioneNo", { tipo })}
                  </span>
                )}
              </div>
            </li>
          );
        })}
      </ul>
      {elenco.length > mostrati.length && (
        <p className="text-xs text-slate-600">{t("altriValori", { n: elenco.length - mostrati.length })}</p>
      )}

      {occorrenze > 0 && (
        <div className="flex flex-wrap items-end gap-x-6 gap-y-3 border-t border-amber-200 pt-3">
          <fieldset className="space-y-1">
            <legend className="font-medium">{t("seNonCorretti")}</legend>
            {(
              [
                ["vuoto", t("lasciaVuoti")],
                ["escludi", t("escludiRighe")],
              ] as [SeNonConforme, string][]
            ).map(([valore, etichetta]) => (
              <label key={valore} className="flex items-center gap-2">
                <input
                  type="radio"
                  name={`${id}-se`}
                  checked={c.seNonConforme === valore}
                  onChange={() => onChange({ seNonConforme: valore })}
                />
                {etichetta}
              </label>
            ))}
          </fieldset>
          <button type="button" className="bottone-secondario py-1.5 text-sm" onClick={() => onChange({ tipo: "testo" })}>
            {t("comeTesto")}
          </button>
        </div>
      )}
    </fieldset>
  );
}
