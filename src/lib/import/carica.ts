// Importazione nel database, eseguita dal browser (SPEC §4.1):
// file originale su Supabase Storage, righe inviate a blocchi con la funzione inserisci_righe.
// Così nessun file grande passa dal server dell'app (limite di ~4,5 MB delle funzioni Vercel).

import type { SupabaseClient } from "@supabase/supabase-js";
import { preparaRighe, type Anteprima, type RigaDati } from "./anteprima";
import { tradotto, type Traduttore } from "@/i18n/lingue";

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
// `t` è il traduttore del gruppo "importa".
export function compatibilePerAccodare(a: Anteprima, esistente: DatasetEsistente, t: Traduttore): string | null {
  const nuove = colonneScelte(a);
  const vecchie = esistente.colonne;
  if (nuove.length !== vecchie.length) {
    return t("accodaColonne", { vecchie: vecchie.length, nuove: nuove.length });
  }
  for (let i = 0; i < nuove.length; i++) {
    if (nuove[i].nome !== vecchie[i].nome) {
      return t("accodaNome", { i: i + 1, nuovo: nuove[i].nome, vecchio: vecchie[i].nome });
    }
    if (nuove[i].tipo !== vecchie[i].tipo) {
      return t("accodaTipo", { nome: nuove[i].nome, nuovo: t(`tipo_${nuove[i].tipo}`), vecchio: t(`tipo_${vecchie[i].tipo}`) });
    }
  }
  return null;
}

function avvisiImportazione(a: Anteprima, nonConvertiti: Record<string, number>, t: Traduttore): string[] {
  const avvisi = a.avvisi.map((x) => tradotto(t, x));
  for (const c of a.colonne) {
    if (!c.includi) {
      avvisi.push(t("avvNonImportata", { nome: c.originale }));
      continue;
    }
    for (const x of c.avvisi) avvisi.push(t("avvColonna", { nome: c.originale, avviso: tradotto(t, x) }));
    const n = nonConvertiti[c.nome];
    if (n) avvisi.push(t("avvNonConvertibili", { nome: c.originale, n, tipo: t(`tipo_${c.tipo}`) }));
  }
  return avvisi;
}

function percorsoSicuro(nomeFile: string): string {
  return nomeFile.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\w.-]+/g, "_").slice(-150);
}

export function messaggioErrore(e: unknown, t: Traduttore): string {
  const m = (e as { message?: string })?.message ?? String(e);
  if (/quota/i.test(m)) return t("erroreQuota");
  if (/exceeded the maximum allowed size|payload too large|413/i.test(m)) return t("erroreGrande");
  if (/failed to fetch|network/i.test(m)) return t("erroreRete");
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
  t: Traduttore,
): Promise<Ripresa> {
  const { data: sessione } = await supabase.auth.getUser();
  const utente = sessione.user;
  if (!utente) throw new Error(t("sessioneScaduta"));

  const preparate = destinazioni.map((d) => preparaRighe(d.anteprima));
  const totali = preparate.reduce((s, p) => s + p.righe.length, 0);
  const fatteFinora = (r: Ripresa) =>
    preparate.slice(0, r.destinazione).reduce((s, p) => s + p.righe.length, 0) +
    Math.min(r.blocco * RIGHE_PER_BLOCCO, preparate[r.destinazione]?.righe.length ?? 0);
  let r: Ripresa = { ...ripresa, completati: [...ripresa.completati] };
  const segnala = (fase: string) => aggiorna({ fatte: fatteFinora(r), totali, fase }, r);

  // 1. Record padre dell'importazione
  if (!r.importazioneId) {
    segnala(t("faseRegistrazione"));
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
      segnala(t("faseCaricamento"));
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
            segnala(t("faseSostituzione", { nome: d.esistente.nome }));
            const { error } = await supabase.from("dataset").delete().eq("id", d.esistente.id);
            if (error) throw error;
            await pulisciImportazione(supabase, d.esistente.importazione_id);
          }
          segnala(t("faseCreazione", { nome: d.anteprima.nomeTabella }));
          const creato = await conRiprova<{ id: string; nome: string }>(() =>
            supabase
              .rpc("crea_dataset", {
                p_importazione: importazioneId,
                p_nome: d.anteprima.nomeTabella,
                p_nome_originale: d.anteprima.nomeOriginale,
                p_foglio: d.anteprima.foglio,
                p_colonne: colonneScelte(d.anteprima),
                p_avvisi: avvisiImportazione(d.anteprima, nonConvertiti, t),
              })
              .single(),
          );
          r = { ...r, datasetId: creato.id };
        }
      }

      const nomeTabella = d.modalita === "accoda" && d.esistente ? d.esistente.nome : d.anteprima.nomeTabella;
      for (; r.blocco * RIGHE_PER_BLOCCO < righe.length; r = { ...r, blocco: r.blocco + 1 }) {
        segnala(t("faseInvio", { nome: nomeTabella }));
        const blocco: RigaDati[] = righe.slice(r.blocco * RIGHE_PER_BLOCCO, (r.blocco + 1) * RIGHE_PER_BLOCCO);
        await conRiprova(() => supabase.rpc("inserisci_righe", { p_dataset: r.datasetId, p_righe: blocco }));
      }
      r = { ...r, completati: [...r.completati, { id: r.datasetId!, nome: nomeTabella }] };
    }

    await supabase
      .from("importazioni")
      .update({ stato: "completata", completata_at: new Date().toISOString(), messaggio_errore: null })
      .eq("id", importazioneId);
    segnala(t("faseCompletata"));
    return r;
  } catch (e) {
    await supabase
      .from("importazioni")
      .update({ stato: "errore", messaggio_errore: messaggioErrore(e, t) })
      .eq("id", importazioneId);
    aggiorna({ fatte: fatteFinora(r), totali, fase: t("faseInterrotta") }, r);
    throw Object.assign(new Error(messaggioErrore(e, t)), { ripresa: r });
  }
}
