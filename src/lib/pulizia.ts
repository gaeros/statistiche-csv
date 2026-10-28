import type { SupabaseClient } from "@supabase/supabase-js";

export const GIORNI_CONSERVAZIONE = 30;
const PER_VOLTA = 500;

// Toglie dallo Storage i file originali caricati più di 30 giorni fa.
// Le tabelle e i dati importati restano: si azzera solo il percorso del file.
export async function eliminaOriginaliScaduti(admin: SupabaseClient, adesso = new Date()) {
  const limite = new Date(adesso.getTime() - GIORNI_CONSERVAZIONE * 24 * 3600 * 1000).toISOString();
  const { data, error } = await admin
    .from("importazioni")
    .select("id, percorso_storage")
    .not("percorso_storage", "is", null)
    .lt("created_at", limite)
    .order("created_at")
    .limit(PER_VOLTA);
  if (error) throw error;

  const righe = (data ?? []).filter((r): r is { id: string; percorso_storage: string } => !!r.percorso_storage);
  if (righe.length === 0) return { eliminati: 0, rimanenti: false };

  const { error: errFile } = await admin.storage.from("originali").remove(righe.map((r) => r.percorso_storage));
  if (errFile) throw errFile;
  const { error: errAgg } = await admin
    .from("importazioni")
    .update({ percorso_storage: null })
    .in("id", righe.map((r) => r.id));
  if (errAgg) throw errAgg;

  return { eliminati: righe.length, rimanenti: righe.length === PER_VOLTA };
}
