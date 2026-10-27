// Importazione nel database, eseguita dal browser (SPEC §4.1):
// file originale su Supabase Storage, righe inviate a blocchi con la funzione inserisci_righe.
// Così nessun file grande passa dal server dell'app (limite di ~4,5 MB delle funzioni Vercel).

import type { SupabaseClient } from "@supabase/supabase-js";
import { preparaRighe, type Anteprima, type RigaDati } from "./anteprima";
import { ETICHETTE_TIPO } from "./tipi";

export const RIGHE_PER_BLOCCO = 2000;
export const LIMITE_FILE_BYTE = 50 * 1024 * 1024;

export type Modalita = "nuova" | "sostituisci" | "accoda";

export type DatasetEsistente = {
  id: string;
  nome: string;
  importazione_id: string;
  colonne: { nome: string; originale: string; tipo: string }[];
};

export type Destinazione = {
  anteprima: Anteprima;
  modalita: Modalita;
  esistente?: DatasetEsistente;
};

// Stato salvato a ogni blocco: se qualcosa va storto si riprende da qui.
export type Ripresa = {
  importazioneId?: string;
  caricato?: boolean;
  destinazione: number;
  datasetId?: string;
  blocco: number;
  completati: { id: string; nome: string }[];
};

export type Progresso = { fatte: number; totali: number; fase: string };

export function colonneScelte(a: Anteprima) {
  return a.colonne
    .filter((c) => c.includi)
    .map((c) => ({ nome: c.nome, originale: c.originale, tipo: c.tipo }));
}

// Si può accodare solo se colonne e tipi coincidono, nello stesso ordine.
export function compatibilePerAccodare(a: Anteprima, esistente: DatasetEsistente): string | null {
  const nuove = colonneScelte(a);
  const vecchie = esistente.colonne;
  if (nuove.length !== vecchie.length) {
    return `Il dataset esistente ha ${vecchie.length} colonne, questo file ne ha ${nuove.length}.`;
  }
  for (let i = 0; i < nuove.length; i++) {
    if (nuove[i].nome !== vecchie[i].nome) {
      return `La colonna ${i + 1} si chiama "${nuove[i].nome}" ma nel dataset esistente è "${vecchie[i].nome}".`;
    }
    if (nuove[i].tipo !== vecchie[i].tipo) {
      return `La colonna "${nuove[i].nome}" è ${ETICHETTE_TIPO[nuove[i].tipo]}, nel dataset esistente è ${
        ETICHETTE_TIPO[vecchie[i].tipo as keyof typeof ETICHETTE_TIPO] ?? vecchie[i].tipo
      }.`;
    }
  }
  return null;
}

function avvisiImportazione(a: Anteprima, nonConvertiti: Record<string, number>): string[] {
  const avvisi = [...a.avvisi];
  for (const c of a.colonne) {
    if (!c.includi) {
      avvisi.push(`Colonna "${c.originale}" non importata.`);
      continue;
    }
    for (const x of c.avvisi) avvisi.push(`${c.originale}: ${x}`);
    const n = nonConvertiti[c.nome];
    if (n) avvisi.push(`${c.originale}: ${n} valori non convertibili in ${ETICHETTE_TIPO[c.tipo]}, lasciati vuoti.`);
  }
  return avvisi;
}

function percorsoSicuro(nomeFile: string): string {
  return nomeFile.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\w.-]+/g, "_").slice(-150);
}

export function messaggioErrore(e: unknown): string {
  const m = (e as { message?: string })?.message ?? String(e);
  if (/quota/i.test(m)) return "Quota di spazio superata (100 MB): elimina qualche dataset e riprova.";
  if (/exceeded the maximum allowed size|payload too large|413/i.test(m)) return "File troppo grande (massimo 50 MB).";
  if (/failed to fetch|network/i.test(m)) return "Connessione interrotta. Controlla la rete e premi Riprova.";
  return m;
}

async function conRiprova<T>(azione: () => PromiseLike<{ data: T | null; error: unknown }>): Promise<T> {
  let ultimo: unknown;
  for (let tentativo = 0; tentativo < 3; tentativo++) {
    const { data, error } = await azione();
    if (!error) return data as T;
    ultimo = error;
    const m = (error as { message?: string })?.message ?? "";
    if (/quota|non valido|non trovato|not found/i.test(m)) break; // inutile riprovare
    await new Promise((r) => setTimeout(r, 1000 * 2 ** tentativo));
  }
  throw ultimo;
}

// Se un'importazione resta senza dataset, la si elimina con il file originale.
export async function pulisciImportazione(supabase: SupabaseClient, importazioneId: string) {
  const { count } = await supabase
    .from("dataset")
    .select("id", { count: "exact", head: true })
    .eq("importazione_id", importazioneId);
  if (count !== 0) return;
  const { data } = await supabase.from("importazioni").select("percorso_storage").eq("id", importazioneId).single();
  if (data?.percorso_storage) await supabase.storage.from("originali").remove([data.percorso_storage]);
  await supabase.from("importazioni").delete().eq("id", importazioneId);
}

export async function importa(
  supabase: SupabaseClient,
  file: File,
  destinazioni: Destinazione[],
  ripresa: Ripresa,
  aggiorna: (p: Progresso, r: Ripresa) => void,
): Promise<Ripresa> {
  const { data: sessione } = await supabase.auth.getUser();
  const utente = sessione.user;
  if (!utente) throw new Error("Sessione scaduta: accedi di nuovo.");

  const preparate = destinazioni.map((d) => preparaRighe(d.anteprima));
  const totali = preparate.reduce((s, p) => s + p.righe.length, 0);
  const fatteFinora = (r: Ripresa) =>
    preparate.slice(0, r.destinazione).reduce((s, p) => s + p.righe.length, 0) +
    Math.min(r.blocco * RIGHE_PER_BLOCCO, preparate[r.destinazione]?.righe.length ?? 0);
  let r: Ripresa = { ...ripresa, completati: [...ripresa.completati] };
  const segnala = (fase: string) => aggiorna({ fatte: fatteFinora(r), totali, fase }, r);

  // 1. Record padre dell'importazione
  if (!r.importazioneId) {
    segnala("Registrazione dell'importazione…");
    const { data, error } = await supabase
      .from("importazioni")
      .insert({ nome_file: file.name, tipo_file: file.type || "sconosciuto", dimensione_byte: file.size })
      .select("id")
      .single();
    if (error) throw error;
    r = { ...r, importazioneId: data.id };
  }
  const importazioneId = r.importazioneId!;

  try {
    // 2. File originale nella cartella privata dell'utente
    if (!r.caricato) {
      segnala("Caricamento del file originale…");
      const percorso = `${utente.id}/${importazioneId}/${percorsoSicuro(file.name)}`;
      const { error } = await supabase.storage.from("originali").upload(percorso, file, { upsert: true });
      if (error) throw error;
      await supabase.from("importazioni").update({ percorso_storage: percorso }).eq("id", importazioneId);
      r = { ...r, caricato: true };
    }

    // 3. Una tabella per ogni destinazione, righe a blocchi
    for (; r.destinazione < destinazioni.length; r = { ...r, destinazione: r.destinazione + 1, datasetId: undefined, blocco: 0 }) {
      const d = destinazioni[r.destinazione];
      const { righe, nonConvertiti } = preparate[r.destinazione];

      if (!r.datasetId) {
        if (d.modalita === "accoda" && d.esistente) {
          r = { ...r, datasetId: d.esistente.id };
        } else {
          if (d.modalita === "sostituisci" && d.esistente) {
            segnala(`Sostituzione di ${d.esistente.nome}…`);
            const { error } = await supabase.from("dataset").delete().eq("id", d.esistente.id);
            if (error) throw error;
            await pulisciImportazione(supabase, d.esistente.importazione_id);
          }
          segnala(`Creazione della tabella ${d.anteprima.nomeTabella}…`);
          const creato = await conRiprova<{ id: string; nome: string }>(() =>
            supabase
              .rpc("crea_dataset", {
                p_importazione: importazioneId,
                p_nome: d.anteprima.nomeTabella,
                p_nome_originale: d.anteprima.nomeOriginale,
                p_foglio: d.anteprima.foglio,
                p_colonne: colonneScelte(d.anteprima),
                p_avvisi: avvisiImportazione(d.anteprima, nonConvertiti),
              })
              .single(),
          );
          r = { ...r, datasetId: creato.id };
        }
      }

      const nomeTabella = d.modalita === "accoda" && d.esistente ? d.esistente.nome : d.anteprima.nomeTabella;
      for (; r.blocco * RIGHE_PER_BLOCCO < righe.length; r = { ...r, blocco: r.blocco + 1 }) {
        segnala(`Invio delle righe di ${nomeTabella}…`);
        const blocco: RigaDati[] = righe.slice(r.blocco * RIGHE_PER_BLOCCO, (r.blocco + 1) * RIGHE_PER_BLOCCO);
        await conRiprova(() => supabase.rpc("inserisci_righe", { p_dataset: r.datasetId, p_righe: blocco }));
      }
      r = { ...r, completati: [...r.completati, { id: r.datasetId!, nome: nomeTabella }] };
    }

    await supabase
      .from("importazioni")
      .update({ stato: "completata", completata_at: new Date().toISOString(), messaggio_errore: null })
      .eq("id", importazioneId);
    segnala("Completata");
    return r;
  } catch (e) {
    await supabase
      .from("importazioni")
      .update({ stato: "errore", messaggio_errore: messaggioErrore(e) })
      .eq("id", importazioneId);
    aggiorna({ fatte: fatteFinora(r), totali, fase: "Interrotta" }, r);
    throw Object.assign(new Error(messaggioErrore(e)), { ripresa: r });
  }
}
