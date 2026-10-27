"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Messaggio } from "@/components/Messaggio";
import { creaAnteprima, type Anteprima } from "@/lib/import/anteprima";
import {
  compatibilePerAccodare,
  importa,
  LIMITE_FILE_BYTE,
  type DatasetEsistente,
  type Modalita,
  type Progresso,
  type Ripresa,
} from "@/lib/import/carica";
import { ErroreLettura, ESTENSIONI, estensione, leggiFile, type Encoding, type FileLetto } from "@/lib/import/lettura";
import { createClient } from "@/lib/supabase/client";
import { SchedaAnteprima } from "./SchedaAnteprima";

export type Scheda = {
  chiave: string;
  selezionata: boolean;
  anteprima: Anteprima;
  modalita: Modalita;
  confermaSostituzione: boolean;
};

type Voce = {
  id: string;
  file: File;
  stato: "lettura" | "pronto" | "errore" | "importazione" | "interrotta" | "completata";
  errore?: string;
  letto?: FileLetto;
  encoding?: Encoding;
  separatore?: string;
  schede: Scheda[];
  progresso?: Progresso;
  ripresa?: Ripresa;
};

const formatoMB = (byte: number) =>
  byte < 1024 * 1024
    ? `${Math.max(1, Math.round(byte / 1024)).toLocaleString("it-IT")} KB`
    : `${(byte / 1024 / 1024).toLocaleString("it-IT", { maximumFractionDigits: 1 })} MB`;

function nuoveSchede(letto: FileLetto, file: File): Scheda[] {
  return letto.fogli.map((f, i) => {
    const anteprima = creaAnteprima(f, file.name);
    return {
      chiave: `${i}-${f.nome ?? "csv"}`,
      selezionata: f.righe.length > 0,
      anteprima,
      modalita: "nuova",
      confermaSostituzione: false,
    };
  });
}

export function Importatore() {
  const supabase = useMemo(() => createClient(), []);
  const [voci, setVoci] = useState<Voce[]>([]);
  const [esistenti, setEsistenti] = useState<DatasetEsistente[]>([]);
  const [trascinamento, setTrascinamento] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  const caricaEsistenti = useCallback(async () => {
    const { data } = await supabase.from("dataset").select("id, nome, importazione_id, colonne");
    setEsistenti((data as DatasetEsistente[]) ?? []);
  }, [supabase]);

  useEffect(() => {
    caricaEsistenti();
  }, [caricaEsistenti]);

  const aggiornaVoce = useCallback((id: string, modifica: (v: Voce) => Voce) => {
    setVoci((tutte) => tutte.map((v) => (v.id === id ? modifica(v) : v)));
  }, []);

  const leggi = useCallback(
    async (voce: Voce, opzioni: { encoding?: Encoding; separatore?: string } = {}) => {
      try {
        const letto = await leggiFile(voce.file, opzioni);
        if (letto.fogli.every((f) => f.righe.length === 0)) throw new ErroreLettura("Il file è vuoto.");
        aggiornaVoce(voce.id, (v) => ({
          ...v,
          stato: "pronto",
          errore: undefined,
          letto,
          encoding: opzioni.encoding,
          separatore: opzioni.separatore,
          schede: nuoveSchede(letto, voce.file),
        }));
      } catch (e) {
        aggiornaVoce(voce.id, (v) => ({
          ...v,
          stato: "errore",
          errore: e instanceof ErroreLettura ? e.message : "Il file non è leggibile o è danneggiato.",
        }));
      }
    },
    [aggiornaVoce],
  );

  const aggiungiFile = useCallback(
    (elenco: FileList | File[]) => {
      const nuove: Voce[] = Array.from(elenco).map((file) => {
        const base: Voce = { id: crypto.randomUUID(), file, stato: "lettura", schede: [] };
        if (!ESTENSIONI.includes(estensione(file.name))) {
          return { ...base, stato: "errore", errore: "Formato non supportato. Usa CSV, TSV, TXT, XLSX o XLS." };
        }
        if (file.size > LIMITE_FILE_BYTE) {
          return { ...base, stato: "errore", errore: `File troppo grande (${formatoMB(file.size)}): il massimo è 50 MB.` };
        }
        if (file.size === 0) return { ...base, stato: "errore", errore: "Il file è vuoto." };
        return base;
      });
      setVoci((v) => [...v, ...nuove]);
      nuove.filter((v) => v.stato === "lettura").forEach((v) => leggi(v));
    },
    [leggi],
  );

  async function avvia(voce: Voce) {
    const scelte = voce.schede.filter((s) => s.selezionata);
    const destinazioni = scelte.map((s) => ({
      anteprima: s.anteprima,
      modalita: s.modalita,
      esistente: esistenti.find((e) => e.nome === s.anteprima.nomeTabella),
    }));
    aggiornaVoce(voce.id, (v) => ({ ...v, stato: "importazione", errore: undefined }));
    try {
      const ripresa = await importa(
        supabase,
        voce.file,
        destinazioni,
        voce.ripresa ?? { destinazione: 0, blocco: 0, completati: [] },
        (progresso, ripresa) => aggiornaVoce(voce.id, (v) => ({ ...v, progresso, ripresa })),
      );
      aggiornaVoce(voce.id, (v) => ({ ...v, stato: "completata", ripresa }));
      caricaEsistenti();
    } catch (e) {
      aggiornaVoce(voce.id, (v) => ({
        ...v,
        stato: "interrotta",
        errore: (e as Error).message,
        ripresa: (e as { ripresa?: Ripresa }).ripresa ?? v.ripresa,
      }));
    }
  }

  return (
    <div className="space-y-6">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setTrascinamento(true);
        }}
        onDragLeave={() => setTrascinamento(false)}
        onDrop={(e) => {
          e.preventDefault();
          setTrascinamento(false);
          aggiungiFile(e.dataTransfer.files);
        }}
        className={`flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-4 py-10 text-center transition ${
          trascinamento
            ? "border-blue-500 bg-blue-50 dark:bg-blue-950/40"
            : "border-slate-300 bg-white dark:border-slate-700 dark:bg-slate-900"
        }`}
      >
        <p className="font-medium">Trascina qui i file</p>
        <p className="text-sm text-slate-500">oppure</p>
        <button type="button" className="bottone" onClick={() => input.current?.click()}>
          Scegli file
        </button>
        <input
          ref={input}
          type="file"
          multiple
          hidden
          accept={ESTENSIONI.map((e) => `.${e}`).join(",")}
          onChange={(e) => {
            if (e.target.files) aggiungiFile(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {voci.map((voce) => (
        <section key={voce.id} className="scheda space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h2 className="font-semibold break-all">{voce.file.name}</h2>
              <p className="text-sm text-slate-500">
                {formatoMB(voce.file.size)}
                {voce.letto?.tipo === "csv" &&
                  ` · ${voce.letto.encoding === "utf-8" ? "UTF-8" : "Windows-1252"} · separatore ${
                    voce.letto.separatore === "\t" ? "tabulazione" : `"${voce.letto.separatore}"`
                  }`}
              </p>
            </div>
            {(voce.stato === "pronto" || voce.stato === "errore" || voce.stato === "completata") && (
              <button
                type="button"
                className="text-sm text-slate-500 hover:underline"
                onClick={() => setVoci((v) => v.filter((x) => x.id !== voce.id))}
              >
                Togli dall&apos;elenco
              </button>
            )}
          </div>

          {voce.stato === "lettura" && <p className="text-sm text-slate-500">Lettura del file…</p>}
          {voce.stato === "errore" && <Messaggio tipo="errore" testo={voce.errore} />}

          {voce.stato === "pronto" && voce.letto && (
            <>
              {voce.letto.tipo === "csv" && (
                <div className="flex flex-wrap gap-4 text-sm">
                  <label className="flex items-center gap-2">
                    Codifica
                    <select
                      className="campo w-auto py-1"
                      value={voce.encoding ?? ""}
                      onChange={(e) =>
                        leggi(voce, { encoding: (e.target.value || undefined) as Encoding | undefined, separatore: voce.separatore })
                      }
                    >
                      <option value="">Automatica</option>
                      <option value="utf-8">UTF-8</option>
                      <option value="windows-1252">Windows-1252 / Latin-1</option>
                    </select>
                  </label>
                  <label className="flex items-center gap-2">
                    Separatore
                    <select
                      className="campo w-auto py-1"
                      value={voce.separatore ?? ""}
                      onChange={(e) => leggi(voce, { encoding: voce.encoding, separatore: e.target.value || undefined })}
                    >
                      <option value="">Automatico</option>
                      <option value=";">Punto e virgola ;</option>
                      <option value=",">Virgola ,</option>
                      <option value={"\t"}>Tabulazione</option>
                      <option value="|">Barra verticale |</option>
                    </select>
                  </label>
                </div>
              )}

              {voce.letto.tipo === "excel" && voce.schede.length > 1 && (
                <fieldset className="space-y-2">
                  <legend className="text-sm font-medium">Fogli da importare</legend>
                  <div className="flex flex-wrap gap-4">
                    {voce.schede.map((s, i) => (
                      <label key={s.chiave} className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={s.selezionata}
                          disabled={s.anteprima.righe.length === 0 && s.anteprima.colonne.length === 0}
                          onChange={(e) =>
                            aggiornaVoce(voce.id, (v) => ({
                              ...v,
                              schede: v.schede.map((x, j) => (j === i ? { ...x, selezionata: e.target.checked } : x)),
                            }))
                          }
                        />
                        {s.anteprima.foglio}
                        {s.anteprima.colonne.length === 0 && <span className="text-slate-400">(vuoto)</span>}
                      </label>
                    ))}
                  </div>
                </fieldset>
              )}

              {voce.schede.map((s, i) =>
                s.selezionata ? (
                  <SchedaAnteprima
                    key={s.chiave}
                    scheda={s}
                    foglio={voce.letto!.fogli[i]}
                    nomeFile={voce.file.name}
                    esistente={esistenti.find((e) => e.nome === s.anteprima.nomeTabella)}
                    altriNomi={voce.schede.filter((x, j) => j !== i && x.selezionata).map((x) => x.anteprima.nomeTabella)}
                    onChange={(nuova) =>
                      aggiornaVoce(voce.id, (v) => ({
                        ...v,
                        schede: v.schede.map((x, j) => (j === i ? nuova : x)),
                      }))
                    }
                  />
                ) : null,
              )}

              <PulsanteImporta voce={voce} esistenti={esistenti} onAvvia={() => avvia(voce)} />
            </>
          )}

          {(voce.stato === "importazione" || voce.stato === "interrotta") && voce.progresso && (
            <div className="space-y-2">
              <div className="h-3 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                <div
                  className="h-full bg-blue-600 transition-all"
                  style={{
                    width: `${voce.progresso.totali ? (voce.progresso.fatte / voce.progresso.totali) * 100 : 0}%`,
                  }}
                />
              </div>
              <p className="text-sm text-slate-500">
                {voce.progresso.fase} {voce.progresso.fatte.toLocaleString("it-IT")} di{" "}
                {voce.progresso.totali.toLocaleString("it-IT")} righe
              </p>
            </div>
          )}

          {voce.stato === "interrotta" && (
            <div className="space-y-3">
              <Messaggio tipo="errore" testo={voce.errore} />
              <button type="button" className="bottone" onClick={() => avvia(voce)}>
                Riprova da dove si era fermata
              </button>
            </div>
          )}

          {voce.stato === "completata" && (
            <div className="space-y-2">
              <Messaggio tipo="ok" testo="Importazione completata." />
              <ul className="list-inside list-disc text-sm">
                {voce.ripresa?.completati.map((d) => (
                  <li key={d.id}>
                    <Link href={`/dataset/${d.id}`} className="link">
                      {d.nome}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      ))}
    </div>
  );
}

function problemi(voce: Voce, esistenti: DatasetEsistente[]): string[] {
  const scelte = voce.schede.filter((s) => s.selezionata);
  const elenco: string[] = [];
  if (scelte.length === 0) elenco.push("Scegli almeno un foglio da importare.");
  const nomi = scelte.map((s) => s.anteprima.nomeTabella);
  if (new Set(nomi).size !== nomi.length) elenco.push("Due fogli hanno lo stesso nome di tabella: cambiane uno.");
  for (const s of scelte) {
    const a = s.anteprima;
    const etichetta = a.foglio ? `Foglio ${a.foglio}` : "Tabella";
    if (!/^[a-z_][a-z0-9_]{0,52}$/.test(a.nomeTabella)) {
      elenco.push(`${etichetta}: il nome può contenere solo lettere minuscole, numeri e _ (massimo 53 caratteri).`);
    }
    const incluse = a.colonne.filter((c) => c.includi);
    if (incluse.length === 0) elenco.push(`${etichetta}: scegli almeno una colonna.`);
    const nomiColonne = incluse.map((c) => c.nome);
    if (new Set(nomiColonne).size !== nomiColonne.length) elenco.push(`${etichetta}: ci sono due colonne con lo stesso nome.`);
    if (incluse.some((c) => !/^[a-z_][a-z0-9_]{0,62}$/.test(c.nome) || ["id", "user_id", "created_at"].includes(c.nome))) {
      elenco.push(`${etichetta}: un nome di colonna non è valido (solo minuscole, numeri e _; non id, user_id, created_at).`);
    }
    const esistente = esistenti.find((e) => e.nome === a.nomeTabella);
    if (esistente && s.modalita === "sostituisci" && !s.confermaSostituzione) {
      elenco.push(`${etichetta}: conferma la sostituzione di ${esistente.nome}.`);
    }
    if (esistente && s.modalita === "accoda") {
      const motivo = compatibilePerAccodare(a, esistente);
      if (motivo) elenco.push(`${etichetta}: impossibile accodare. ${motivo}`);
    }
  }
  return elenco;
}

function PulsanteImporta({ voce, esistenti, onAvvia }: { voce: Voce; esistenti: DatasetEsistente[]; onAvvia: () => void }) {
  const elenco = problemi(voce, esistenti);
  const righe = voce.schede.filter((s) => s.selezionata).reduce((n, s) => n + s.anteprima.righe.length, 0);
  return (
    <div className="space-y-3 border-t border-slate-200 pt-4 dark:border-slate-800">
      {elenco.length > 0 && (
        <ul className="list-inside list-disc text-sm text-amber-700 dark:text-amber-300">
          {elenco.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      )}
      <button type="button" className="bottone" disabled={elenco.length > 0} onClick={onAvvia}>
        Importa {righe.toLocaleString("it-IT")} righe
      </button>
    </div>
  );
}
