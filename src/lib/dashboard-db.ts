import "server-only";
import { createClient } from "@/lib/supabase/server";

type Esito = { ok: true } | { ok: false; troppi?: boolean; dettaglio?: string };

// Legge la dashboard dell'utente, applica la modifica e la salva. Prima di salvare toglie gli id
// dei grafici che non esistono più (eliminati) o che non sono dell'utente (la RLS li nasconde).
// La modifica restituisce null se la dashboard è piena.
export async function cambiaDashboard(modifica: (ids: string[]) => string[] | null): Promise<Esito> {
  const supabase = await createClient();
  const { data: utente } = await supabase.auth.getUser();
  if (!utente.user) return { ok: false };

  const { data: riga, error } = await supabase.from("dashboard").select("grafici").maybeSingle();
  if (error) return { ok: false, dettaglio: error.message };
  const nuovi = modifica((riga?.grafici as string[] | undefined) ?? []);
  if (!nuovi) return { ok: false, troppi: true };

  let validi: string[] = [];
  if (nuovi.length) {
    const { data: esistenti, error: e } = await supabase.from("grafici").select("id").in("id", nuovi);
    if (e) return { ok: false, dettaglio: e.message };
    const presenti = new Set((esistenti ?? []).map((g) => g.id as string));
    validi = nuovi.filter((id) => presenti.has(id));
  }

  const { error: e } = await supabase
    .from("dashboard")
    .upsert({ user_id: utente.user.id, grafici: validi, updated_at: new Date().toISOString() });
  return e ? { ok: false, dettaglio: e.message } : { ok: true };
}
