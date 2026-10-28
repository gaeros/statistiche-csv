"use server";

import { redirect } from "next/navigation";
import type { StatoForm } from "@/app/accedi/actions";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

// Elimina l'account e tutti i dati (SPEC §8.2). Le tabelle, i dataset, le importazioni e i grafici
// si cancellano a cascata con l'utente; i file originali vanno tolti dallo Storage prima.
export async function eliminaAccount(_prev: StatoForm, formData: FormData): Promise<StatoForm> {
  if (String(formData.get("conferma") ?? "").trim().toUpperCase() !== "ELIMINA") {
    return { errore: "Per confermare scrivi ELIMINA nella casella." };
  }

  const supabase = await createClient();
  const { data: sessione } = await supabase.auth.getUser();
  const utente = sessione.user;
  if (!utente) redirect("/accedi");

  const { data: importazioni } = await supabase.from("importazioni").select("percorso_storage");
  const percorsi = (importazioni ?? []).map((i) => i.percorso_storage).filter((p): p is string => !!p);
  if (percorsi.length) {
    const { error } = await supabase.storage.from("originali").remove(percorsi);
    if (error) return { errore: `Non è stato possibile eliminare i file originali: ${error.message}` };
  }

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.deleteUser(utente.id);
  if (error) return { errore: `Eliminazione non riuscita: ${error.message}` };
  // Toglie anche l'invito, così l'indirizzo non resta salvato e non può riregistrarsi senza un nuovo invito.
  if (utente.email) await admin.from("inviti").delete().eq("email", utente.email.toLowerCase());

  await supabase.auth.signOut();
  redirect("/accedi?eliminato=1");
}
